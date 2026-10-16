import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import {
  buildGoogleAuthorizeUrl,
  createPkcePair,
  fetchGoogleProfile,
  isGoogleConfigured,
} from '../auth/google.js';
import { optionalAuth } from '../auth/middleware.js';
import {
  clearOAuthStateCookie,
  clearSessionCookie,
  isSessionConfigured,
  readOAuthStateCookie,
  sanitizeReturnTo,
  setOAuthStateCookie,
  setSessionCookie,
} from '../auth/session.js';
import { priceAlerts } from '../priceAlerts/composition.js';
import { upsertSocialUser } from '../db/users.js';

const router = Router();

/** 로그인 실패 시 프론트 로그인 화면으로 돌려보내며 원인 코드를 전달한다. */
function redirectToLoginError(res: Response, error: string, returnTo = '/') {
  const params = new URLSearchParams({ error, returnTo });
  res.redirect(`/login?${params.toString()}`);
}

/**
 * GET /api/auth/me
 * 현재 로그인한 사용자. 비로그인이어도 200 + { user: null } (로그인은 선택 사항이므로)
 */
router.get('/me', optionalAuth, async (req: Request, res: Response) => {
  // 로그인 사용자의 새 알림 수 (헤더 배지). 조회에 실패해도 로그인 상태 확인은 막지 않는다.
  let priceChanges = 0;
  if (req.user) {
    priceChanges = await priceAlerts().countNew(req.user.id).catch(() => 0);
  }

  res.set('Cache-Control', 'no-store');
  res.status(200).json({
    user: req.user ?? null,
    alerts: { priceChanges },
    providers: {
      google: isGoogleConfigured() && isSessionConfigured(),
      dev: isDevLoginEnabled(),
    },
  });
});

// ── 개발용 테스트 로그인 ────────────────────────────────────────
// Google OAuth 설정 없이 로그인 기능을 테스트하기 위한 임시 경로.
// backend/.env 에 DEV_LOGIN=true 가 있고 NODE_ENV 가 production 이 아닐 때만 열린다.

const DEV_ACCOUNT_COUNT = 3;

function isDevLoginEnabled(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.DEV_LOGIN === 'true' &&
    isSessionConfigured()
  );
}

/**
 * GET /api/auth/dev-login?account=1&returnTo=/mypage
 * 테스트 계정(1~3)으로 즉시 로그인. 비활성 상태면 존재하지 않는 경로처럼 404.
 */
router.get('/dev-login', async (req: Request, res: Response) => {
  if (!isDevLoginEnabled()) {
    res.status(404).json({ message: 'Not Found' });
    return;
  }

  const returnTo = sanitizeReturnTo(req.query.returnTo);
  const requested = Number(req.query.account);
  const account =
    Number.isInteger(requested) && requested >= 1 && requested <= DEV_ACCOUNT_COUNT
      ? requested
      : 1;

  try {
    const user = await upsertSocialUser({
      provider: 'DEV',
      providerUserId: `dev-${account}`,
      email: `dev${account}@burgerpick.test`,
      displayName: `테스트 사용자 ${account}`,
      avatarUrl: null,
    });
    setSessionCookie(res, user.id);
    res.redirect(returnTo);
  } catch (error) {
    console.error('❌ 테스트 로그인 처리 오류:', error);
    redirectToLoginError(res, 'failed', returnTo);
  }
});

/**
 * GET /api/auth/google?returnTo=/ranking
 * Google 로그인 화면으로 이동. state / PKCE verifier / returnTo 는 서명된 임시 쿠키에 보관한다.
 */
router.get('/google', (req: Request, res: Response) => {
  const returnTo = sanitizeReturnTo(req.query.returnTo);
  if (!isGoogleConfigured() || !isSessionConfigured()) {
    redirectToLoginError(res, 'not_configured', returnTo);
    return;
  }

  const state = crypto.randomBytes(16).toString('base64url');
  const { codeVerifier, codeChallenge } = createPkcePair();
  setOAuthStateCookie(res, { state, codeVerifier, returnTo });
  res.redirect(buildGoogleAuthorizeUrl(state, codeChallenge));
});

/**
 * GET /api/auth/google/callback
 * Google 이 인가 코드와 함께 돌려보내는 주소. (Google Cloud Console 의 "승인된 리디렉션 URI")
 */
router.get('/google/callback', async (req: Request, res: Response) => {
  const saved = readOAuthStateCookie(req);
  clearOAuthStateCookie(res);
  const returnTo = saved?.returnTo ?? '/';

  if (typeof req.query.error === 'string') {
    // 사용자가 Google 화면에서 취소한 경우 등
    redirectToLoginError(res, 'cancelled', returnTo);
    return;
  }

  const { code, state } = req.query;
  if (!saved || typeof code !== 'string' || typeof state !== 'string' || state !== saved.state) {
    redirectToLoginError(res, 'invalid_state', returnTo);
    return;
  }

  try {
    const profile = await fetchGoogleProfile(code, saved.codeVerifier);
    const user = await upsertSocialUser(profile);
    setSessionCookie(res, user.id);
    res.redirect(returnTo);
  } catch (error) {
    console.error('❌ Google 로그인 처리 오류:', error);
    redirectToLoginError(res, 'failed', returnTo);
  }
});

/**
 * POST /api/auth/logout
 * 세션 쿠키 삭제. (쿠키가 SameSite=Lax 라 다른 사이트에서 POST 로 로그아웃시킬 수 없다)
 */
router.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.status(204).end();
});

export default router;

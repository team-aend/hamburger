import crypto from 'crypto';
import type { CookieOptions, Request, Response } from 'express';

export const SESSION_COOKIE = 'bp_session';
export const OAUTH_STATE_COOKIE = 'bp_oauth';

const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30일
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000; // 10분

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error(
      'SESSION_SECRET 환경변수가 없거나 너무 짧습니다(32자 이상). backend/.env 를 확인해 주세요.'
    );
  }
  return secret;
}

export function isSessionConfigured(): boolean {
  return (process.env.SESSION_SECRET?.trim().length ?? 0) >= 32;
}

/**
 * payload 를 HMAC-SHA256 으로 서명한 "base64url(payload).signature" 토큰.
 * 서버만 SESSION_SECRET 을 알기 때문에 클라이언트가 내용을 바꾸면 검증에 실패한다.
 */
function sign(payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verify<T extends { exp: number }>(token: string | undefined): T | null {
  if (!token) return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac('sha256', getSessionSecret())
    .update(body)
    .digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString()) as T;
    return payload.exp > Date.now() ? payload : null;
  } catch {
    return null;
  }
}

export function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  if (!header) return {};
  return Object.fromEntries(
    header.split(';').flatMap((part) => {
      const index = part.indexOf('=');
      if (index < 0) return [];
      const key = part.slice(0, index).trim();
      const value = part.slice(index + 1).trim();
      try {
        return [[key, decodeURIComponent(value)]];
      } catch {
        return [];
      }
    })
  );
}

function cookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

// ── 로그인 세션 ──

interface SessionPayload {
  uid: number;
  exp: number;
}

export function setSessionCookie(res: Response, userId: number): void {
  const token = sign({ uid: userId, exp: Date.now() + SESSION_MAX_AGE_MS });
  res.cookie(SESSION_COOKIE, token, cookieOptions(SESSION_MAX_AGE_MS));
}

export function readSessionUserId(req: Request): number | null {
  if (!isSessionConfigured()) return null;
  const payload = verify<SessionPayload>(parseCookies(req)[SESSION_COOKIE]);
  return payload ? payload.uid : null;
}

export function clearSessionCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = cookieOptions(0);
  res.clearCookie(SESSION_COOKIE, options);
}

// ── OAuth 진행 중 상태 (CSRF 방지용 state + PKCE verifier + 로그인 후 돌아갈 경로) ──

export interface OAuthState {
  state: string;
  codeVerifier: string;
  returnTo: string;
  exp: number;
}

export function setOAuthStateCookie(
  res: Response,
  value: Omit<OAuthState, 'exp'>
): void {
  const token = sign({ ...value, exp: Date.now() + OAUTH_STATE_MAX_AGE_MS });
  res.cookie(OAUTH_STATE_COOKIE, token, cookieOptions(OAUTH_STATE_MAX_AGE_MS));
}

export function readOAuthStateCookie(req: Request): OAuthState | null {
  return verify<OAuthState>(parseCookies(req)[OAUTH_STATE_COOKIE]);
}

export function clearOAuthStateCookie(res: Response): void {
  const { maxAge: _maxAge, ...options } = cookieOptions(0);
  res.clearCookie(OAUTH_STATE_COOKIE, options);
}

/** 오픈 리다이렉트 방지: 같은 사이트 내부 경로("/..." 이면서 "//" 로 시작하지 않음)만 허용 */
export function sanitizeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return '/';
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
}

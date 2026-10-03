import crypto from 'crypto';
import type { SocialProfile } from '../db/users.js';

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';

interface GoogleConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

function getGoogleConfig(): GoogleConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function isGoogleConfigured(): boolean {
  return getGoogleConfig() !== null;
}

export function createPkcePair(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString('base64url');
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');
  return { codeVerifier, codeChallenge };
}

export function buildGoogleAuthorizeUrl(state: string, codeChallenge: string): string {
  const config = getGoogleConfig();
  if (!config) throw new Error('Google OAuth 환경변수가 설정되지 않았습니다.');

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * 인가 코드를 토큰으로 교환한 뒤, access token 으로 Google 사용자 정보를 조회한다.
 * (토큰/사용자 정보 모두 서버가 Google 과 TLS 로 직접 주고받으므로 별도의 id_token 서명 검증은 하지 않는다.)
 */
export async function fetchGoogleProfile(
  code: string,
  codeVerifier: string
): Promise<SocialProfile> {
  const config = getGoogleConfig();
  if (!config) throw new Error('Google OAuth 환경변수가 설정되지 않았습니다.');

  const tokenRes = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
  });
  if (!tokenRes.ok) {
    throw new Error(`Google 토큰 교환 실패 (${tokenRes.status}): ${await tokenRes.text()}`);
  }
  const { access_token: accessToken } = (await tokenRes.json()) as {
    access_token?: string;
  };
  if (!accessToken) throw new Error('Google 토큰 응답에 access_token 이 없습니다.');

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) {
    throw new Error(`Google 사용자 정보 조회 실패 (${userRes.status})`);
  }
  const info = (await userRes.json()) as {
    sub: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
    picture?: string;
  };

  const email = info.email && info.email_verified ? info.email : null;
  return {
    provider: 'GOOGLE',
    providerUserId: info.sub,
    email,
    displayName: info.name?.trim() || email?.split('@')[0] || 'Google 사용자',
    avatarUrl: info.picture ?? null,
  };
}

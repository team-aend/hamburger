'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import GoogleLogo from '@/components/auth/GoogleLogo';
import { devLoginHref, googleLoginHref, useAuth } from '@/components/auth/AuthProvider';
import SiteHeader from '@/components/SiteHeader';
import './login.css';

const ERROR_MESSAGES: Record<string, string> = {
  cancelled: 'Google 로그인이 취소되었습니다.',
  invalid_state: '로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.',
  failed: '로그인 처리 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.',
  not_configured: '서버에 Google 로그인 설정이 아직 되어 있지 않습니다.',
};

/** 오픈 리다이렉트 방지: 사이트 내부 경로만 허용 (백엔드 sanitizeReturnTo 와 동일 규칙) */
function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) {
    return '/';
  }
  return value;
}

export default function LoginPage() {
  return (
    <main className="worldcup-shell login-shell">
      <SiteHeader />
      <Suspense fallback={null}>
        <LoginContent />
      </Suspense>
      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>취향에는 정답이 없습니다.</span>
      </footer>
    </main>
  );
}

function LoginContent() {
  const searchParams = useSearchParams();
  const { user, loading, googleEnabled, devLoginEnabled, logout } = useAuth();
  const returnTo = safeReturnTo(searchParams.get('returnTo'));
  const errorCode = searchParams.get('error');
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] ?? ERROR_MESSAGES.failed : null;

  return (
    <section className="login-content" aria-labelledby="login-title">
      <div className="login-copy">
        <span className="eyebrow">BURGER PICK · SIGN IN</span>
        <h1 id="login-title">
          로그인하고,
          <br />
          <strong>내 취향을 남기세요.</strong>
        </h1>
        <p>
          로그인하지 않아도 월드컵·검색·가격 비교는 그대로 이용할 수 있어요.
          <br />
          일부 기능만 로그인이 필요합니다.
        </p>
      </div>

      <div className="login-card">
        {loading ? (
          <p className="login-status">로그인 상태를 확인하는 중...</p>
        ) : user ? (
          <>
            <span className="winner-label">SIGNED IN</span>
            <h2>
              <strong>{user.displayName}</strong>님,
              <br />
              이미 로그인되어 있어요.
            </h2>
            {user.email && <p className="login-email">{user.email}</p>}
            <Link className="start-button login-primary" href={returnTo}>
              계속하기 <span aria-hidden="true">→</span>
            </Link>
            <button type="button" className="reset-button" onClick={() => void logout()}>
              다른 계정으로 로그인하려면 로그아웃
            </button>
          </>
        ) : (
          <>
            <span className="winner-label">SOCIAL LOGIN</span>
            <h2>간편하게 시작하기</h2>

            {errorMessage && (
              <p className="login-error" role="alert">
                {errorMessage}
              </p>
            )}

            {googleEnabled ? (
              // OAuth 는 전체 페이지 이동이어야 하므로 Link 가 아닌 a 태그를 쓴다.
              <a className="google-button" href={googleLoginHref(returnTo)}>
                <GoogleLogo />
                <span>Google로 로그인</span>
              </a>
            ) : (
              <>
                <button type="button" className="google-button" disabled>
                  <GoogleLogo />
                  <span>Google로 로그인</span>
                </button>
                {!errorMessage && !devLoginEnabled && (
                  <p className="login-error">{ERROR_MESSAGES.not_configured}</p>
                )}
              </>
            )}

            {/* 개발용 테스트 로그인 (backend/.env DEV_LOGIN=true 일 때만 보임) */}
            {devLoginEnabled && (
              <div className="dev-login">
                <p>
                  <b>개발용 테스트 로그인</b>
                  <span>Google 설정 없이 바로 로그인합니다. 운영 환경에서는 보이지 않습니다.</span>
                </p>
                <div className="dev-login-accounts">
                  {[1, 2, 3].map((account) => (
                    // 세션 쿠키를 받아야 하므로 전체 페이지 이동(a 태그)으로 요청한다.
                    <a key={account} href={devLoginHref(account, returnTo)}>
                      테스트 사용자 {account}
                    </a>
                  ))}
                </div>
              </div>
            )}

            <p className="login-terms">
              처음 로그인하면 Google 계정의 이름·이메일·프로필 사진으로 회원이 만들어집니다.
            </p>
            <Link className="reset-button login-skip" href={returnTo}>
              로그인 없이 둘러보기
            </Link>
          </>
        )}
      </div>
    </section>
  );
}

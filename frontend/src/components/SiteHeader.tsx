'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { loginHref, useAuth, type AuthUser } from '@/components/auth/AuthProvider';

export type MenuKey = 'worldcup' | 'recommend' | 'compare' | 'game';

type SiteHeaderProps = {
  activeMenu?: MenuKey;
  onSelectMenu?: (menu: MenuKey) => void;
};

const menuItems: { key: MenuKey; label: string; badge?: string }[] = [
  { key: 'worldcup', label: '햄버거 월드컵', badge: 'PLAY' },
  { key: 'recommend', label: '햄버거 검색 · 추천' },
  { key: 'compare', label: '햄버거 비교' },
  { key: 'game', label: '햄버거 쌓기', badge: 'GAME' },
];

export const menuRoutes: Record<MenuKey, string> = {
  worldcup: '/',
  recommend: '/recommend',
  compare: '/compare',
  game: '/game',
};

export default function SiteHeader({ activeMenu, onSelectMenu }: SiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, logout, alerts } = useAuth();
  const priceAlerts = alerts.priceChanges;
  const selectMenu = (menu: MenuKey) => {
    if (onSelectMenu) onSelectMenu(menu);
    else router.push(menuRoutes[menu]);
  };
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isMenuOpen]);

  return (
    <header className="site-header">
      <button
        className="brand brand-button"
        type="button"
        onClick={() => selectMenu('worldcup')}
        aria-label="버거픽 홈"
      >
        <span className="brand-mark" aria-hidden="true">B</span>
        <span>BURGER PICK</span>
      </button>

      <nav
        id="main-navigation"
        className={isMenuOpen ? 'main-navigation open' : 'main-navigation closed'}
        aria-label="주요 메뉴"
        aria-hidden={!isMenuOpen}
      >
        <div className="navigation-heading">MENU</div>
        {menuItems.map((item) => (
          <button
            className={activeMenu === item.key ? 'navigation-item active' : 'navigation-item'}
            key={item.key}
            type="button"
            aria-current={activeMenu === item.key ? 'page' : undefined}
            onClick={() => {
              selectMenu(item.key);
              setIsMenuOpen(false);
              toggleRef.current?.focus();
            }}
            tabIndex={isMenuOpen ? 0 : -1}
          >
            <span>{item.label}</span>
            {item.badge && <small>{item.badge}</small>}
          </button>
        ))}

        <div className="navigation-account">
          <div className="navigation-heading">ACCOUNT</div>
          {user ? (
            <>
              <div className="account-profile">
                <Avatar user={user} size={40} />
                <div>
                  <strong>{user.displayName}</strong>
                  {user.email && <small>{user.email}</small>}
                </div>
              </div>
              <Link
                className={`navigation-item account-mypage ${pathname === '/mypage' ? 'active' : ''}`}
                href={priceAlerts > 0 ? '/mypage?tab=likes' : '/mypage'}
                aria-current={pathname === '/mypage' ? 'page' : undefined}
                tabIndex={isMenuOpen ? 0 : -1}
                onClick={() => setIsMenuOpen(false)}
              >
                <span>마이페이지</span>
                {priceAlerts > 0 ? (
                  <small className="account-alert">가격 변동 {priceAlerts}</small>
                ) : (
                  <small>MY</small>
                )}
              </Link>
              <button
                className="account-logout"
                type="button"
                tabIndex={isMenuOpen ? 0 : -1}
                onClick={async () => {
                  setIsMenuOpen(false);
                  toggleRef.current?.focus();
                  await logout();
                }}
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              className="account-login"
              href={loginHref(pathname)}
              tabIndex={isMenuOpen ? 0 : -1}
              onClick={() => setIsMenuOpen(false)}
            >
              <span>로그인</span>
              <small>Google 계정으로 간편하게</small>
            </Link>
          )}
        </div>
      </nav>

      {/* 로그인은 선택 사항: 비로그인이면 로그인 버튼, 로그인 상태면 프로필(누르면 메뉴 열림) */}
      <div className="header-account">
        {loading ? null : user ? (
          <button
            className="header-profile"
            type="button"
            aria-label={`${user.displayName} 계정 메뉴 열기${
              priceAlerts > 0 ? `, 새 가격 변동 알림 ${priceAlerts}개` : ''
            }`}
            onClick={() => setIsMenuOpen(true)}
          >
            <Avatar user={user} size={30} />
            <span>{user.displayName}</span>
            {priceAlerts > 0 && (
              <b className="header-alert-badge" aria-hidden="true">
                {priceAlerts}
              </b>
            )}
          </button>
        ) : (
          <Link className="header-login" href={loginHref(pathname)}>
            로그인
          </Link>
        )}
      </div>

      <button
        ref={toggleRef}
        className={isMenuOpen ? 'menu-toggle open' : 'menu-toggle'}
        type="button"
        aria-label={isMenuOpen ? '메뉴 숨기기' : '메뉴 보이기'}
        aria-expanded={isMenuOpen}
        aria-controls="main-navigation"
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span /><span /><span />
      </button>
    </header>
  );
}

function Avatar({ user, size }: { user: AuthUser; size: number }) {
  if (user.avatarUrl) {
    return (
      // Google 프로필 이미지는 외부 도메인이라 next/image 대신 img 를 쓴다.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="account-avatar"
        src={user.avatarUrl}
        alt=""
        width={size}
        height={size}
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <span className="account-avatar" style={{ width: size, height: size }} aria-hidden="true">
      {user.displayName.slice(0, 1)}
    </span>
  );
}

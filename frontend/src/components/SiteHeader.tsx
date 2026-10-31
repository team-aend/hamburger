'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { loginHref, useAuth, type AuthUser } from '@/components/auth/AuthProvider';

export type MenuKey = 'worldcup' | 'recommend' | 'compare' | 'game' | 'test';

type SiteHeaderProps = {
  activeMenu?: MenuKey;
  onSelectMenu?: (menu: MenuKey) => void;
};

const menuItems: { key: MenuKey; label: string; badge?: string }[] = [
  { key: 'worldcup', label: '햄버거 월드컵', badge: 'PLAY' },
  { key: 'recommend', label: '버거 검색 · 추천' },
  { key: 'compare', label: '햄버거 비교' },
  { key: 'game', label: '햄버거 쌓기', badge: 'GAME' },
  { key: 'test', label: '버거 심리테스트', badge: 'TEST' },
];

export const menuRoutes: Record<MenuKey, string> = {
  worldcup: '/',
  recommend: '/recommend',
  compare: '/compare',
  game: '/game',
  test: '/burger-mbti',
};

export default function SiteHeader({ activeMenu, onSelectMenu }: SiteHeaderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, alerts } = useAuth();
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

      </nav>

      {/* 비로그인이면 로그인 버튼, 로그인 상태면 마이페이지로 이동하는 프로필 */}
      <div className="header-account">
        {loading ? null : user ? (
          <Link
            className="header-profile"
            href="/mypage"
            aria-label={`${user.displayName} 마이페이지로 이동${
              priceAlerts > 0 ? `, 새 가격 변동 알림 ${priceAlerts}개` : ''
            }`}
            onClick={() => setIsMenuOpen(false)}
          >
            <Avatar user={user} size={30} />
            <span>{user.displayName}</span>
            {priceAlerts > 0 && (
              <b className="header-alert-badge" aria-hidden="true">
                {priceAlerts}
              </b>
            )}
          </Link>
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

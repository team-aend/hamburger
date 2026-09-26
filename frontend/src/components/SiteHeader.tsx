'use client';

import { useEffect, useRef, useState } from 'react';

type MenuKey = 'worldcup';

type SiteHeaderProps = {
  activeMenu: MenuKey;
  onSelectMenu: (menu: MenuKey) => void;
};

const menuItems: { key: MenuKey; label: string; badge?: string }[] = [
  { key: 'worldcup', label: '햄버거 월드컵', badge: 'PLAY' },
];

export default function SiteHeader({ activeMenu, onSelectMenu }: SiteHeaderProps) {
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
        onClick={() => onSelectMenu('worldcup')}
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
              onSelectMenu(item.key);
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

type MenuKey = 'worldcup';

type SiteHeaderProps = {
  activeMenu: MenuKey;
  onSelectMenu: (menu: MenuKey) => void;
};

const menuItems: { key: MenuKey; label: string; badge?: string }[] = [
  { key: 'worldcup', label: '햄버거 월드컵', badge: 'PLAY' },
];

export default function SiteHeader({ activeMenu, onSelectMenu }: SiteHeaderProps) {
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

      <nav className="main-navigation" aria-label="주요 메뉴">
        {menuItems.map((item) => (
          <button
            className={activeMenu === item.key ? 'navigation-item active' : 'navigation-item'}
            key={item.key}
            type="button"
            aria-current={activeMenu === item.key ? 'page' : undefined}
            onClick={() => onSelectMenu(item.key)}
          >
            <span>{item.label}</span>
            {item.badge && <small>{item.badge}</small>}
          </button>
        ))}
      </nav>

      <span className="header-slogan">PICK YOUR FAVORITE</span>
    </header>
  );
}

import type { Metadata } from 'next';
import SiteHeader from '@/components/SiteHeader';
import BurgerGame from '@/components/game/BurgerGame';
import './game.css';

export const metadata: Metadata = {
  title: '햄버거 쌓기 | Burger Pick',
  description: '주문서를 보고 60초 동안 최대한 많은 햄버거를 완성하세요.',
};

export default function GamePage() {
  return (
    <main className="worldcup-shell game-shell">
      {/*
        게임 중에 메뉴나 로고를 누르면 확인 없이 바로 이동한다 (60초짜리 짧은 게임이라 일부러 생략).
        이동 전에 확인이 필요해지면 홈 화면(app/page.tsx)의 navigate 처럼 onSelectMenu 를 넘겨
        진행 중일 때만 window.confirm 을 띄운다. 그러려면 BurgerGame 의 진행 상태를 이 페이지까지 올려야 한다.
      */}
      <SiteHeader activeMenu="game" />
      <div className="game-content">
        <BurgerGame />
      </div>
      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>취향에는 정답이 없습니다.</span>
      </footer>
    </main>
  );
}

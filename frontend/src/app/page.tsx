'use client';

import { useState } from 'react';

type RoundSize = 8 | 16;

export default function HomePage() {
  const [roundSize, setRoundSize] = useState<RoundSize>(8);

  return (
    <main className="worldcup-shell">
      <header className="site-header">
        <a className="brand" href="#" aria-label="버거픽 홈">
          <span className="brand-mark" aria-hidden="true">B</span>
          <span>BURGER PICK</span>
        </a>
        <span className="header-caption">나만의 최애 버거 찾기</span>
      </header>

      <section className="start-screen" aria-labelledby="start-title">
        <div className="hero-copy">
          <span className="eyebrow">THE ULTIMATE BURGER TOURNAMENT</span>
          <h1 id="start-title">오늘의 최애 버거를<strong>직접 골라보세요.</strong></h1>
          <p>고민할 시간은 짧게, 선택은 확실하게.<br />두 버거 중 더 끌리는 하나를 고르면 됩니다.</p>

          <div className="round-picker" aria-label="월드컵 강수 선택">
            <span>몇 강으로 시작할까요?</span>
            <div className="round-options">
              {([8, 16] as const).map((size) => (
                <button className={roundSize === size ? 'round-option selected' : 'round-option'} key={size} type="button" aria-pressed={roundSize === size} onClick={() => setRoundSize(size)}>
                  <b>{size}강</b><small>{size === 8 ? '빠르게 즐기기' : '제대로 겨루기'}</small>
                </button>
              ))}
            </div>
          </div>

          <button className="start-button" type="button">{roundSize}강 월드컵 시작하기<span aria-hidden="true">→</span></button>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="stamp">BEST<br />BURGER</div>
          <div className="burger-halo" />
          <div className="burger-illustration">
            <span className="bun bun-top"><i /><i /><i /></span>
            <span className="lettuce" /><span className="cheese" /><span className="patty" /><span className="tomato" /><span className="bun bun-bottom" />
          </div>
          <span className="versus-badge">VS</span>
          <p>16 BURGERS · ONE WINNER</p>
        </div>
      </section>

      <footer className="site-footer"><span>© 2026 BURGER PICK</span><span>취향에는 정답이 없습니다.</span></footer>
    </main>
  );
}

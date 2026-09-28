'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { loginHref, useAuth } from '@/components/auth/AuthProvider';
import SiteHeader from '@/components/SiteHeader';
import { Burger, burgers } from '@/data/burgers';
import {
  savePendingWorldcupResult,
  submitWorldcupResult,
  type WorldcupMatch,
  type WorldcupResultPayload,
} from '@/lib/worldcupResult';

type RoundSize = 8 | 16;
type Phase = 'setup' | 'playing' | 'finished';
/** 결과 저장 상태. guest: 비로그인이라 로그인 후 저장하도록 보관만 함 */
type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'guest';

const shuffle = <T,>(items: T[]) => {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
  }
  return result;
};

const roundLabel = (count: number) => count === 2 ? '결승' : `${count}강`;

export default function HomePage() {
  const router = useRouter();
  const [roundSize, setRoundSize] = useState<RoundSize>(8);
  const [phase, setPhase] = useState<Phase>('setup');
  const [contestants, setContestants] = useState<Burger[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [roundWinners, setRoundWinners] = useState<Burger[]>([]);
  const [winner, setWinner] = useState<Burger | null>(null);
  const { user } = useAuth();
  const [matchLog, setMatchLog] = useState<WorldcupMatch[]>([]);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastPayload, setLastPayload] = useState<WorldcupResultPayload | null>(null);

  // 로그인 회원은 바로 저장하고, 비로그인은 로그인하러 다녀오는 동안 보관한다.
  const saveResult = async (payload: WorldcupResultPayload) => {
    setLastPayload(payload);
    if (!user) {
      savePendingWorldcupResult(payload);
      setSaveStatus('guest');
      return;
    }
    setSaveStatus('saving');
    try {
      await submitWorldcupResult(payload);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  };

  const startGame = (size = roundSize) => {
    setContestants(shuffle(burgers).slice(0, size));
    setMatchIndex(0);
    setRoundWinners([]);
    setWinner(null);
    setMatchLog([]);
    setSaveStatus('idle');
    setLastPayload(null);
    setPhase('playing');
  };

  const selectBurger = (selected: Burger) => {
    const left = contestants[matchIndex];
    const opponent = left.id === selected.id ? contestants[matchIndex + 1] : left;
    const log = [...matchLog, { round: contestants.length, winner: selected.id, loser: opponent.id }];
    setMatchLog(log);

    const winners = [...roundWinners, selected];
    const isLastMatch = matchIndex + 2 >= contestants.length;

    if (!isLastMatch) {
      setRoundWinners(winners);
      setMatchIndex(matchIndex + 2);
      return;
    }

    if (winners.length === 1) {
      setWinner(selected);
      setPhase('finished');
      void saveResult({ roundSize, winnerBurgerId: selected.id, matches: log });
      return;
    }

    setContestants(winners);
    setRoundWinners([]);
    setMatchIndex(0);
  };

  const resetToSetup = () => {
    if (phase === 'playing' && !window.confirm('진행 중인 월드컵을 종료할까요?')) return;
    setPhase('setup');
    setContestants([]);
    setRoundWinners([]);
    setMatchIndex(0);
    setWinner(null);
  };

  return (
    <main className="worldcup-shell">
      <SiteHeader activeMenu="worldcup" onSelectMenu={(menu) => {
        if (menu === 'worldcup') resetToSetup();
        else if (phase !== 'playing' || window.confirm('진행 중인 월드컵을 종료하고 이동할까요?')) router.push(menu === 'compare' ? '/compare' : '/recommend');
      }} />

      {phase === 'setup' && (
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
            <button className="start-button" type="button" onClick={() => startGame()}>{roundSize}강 월드컵 시작하기<span aria-hidden="true">→</span></button>
            <Link className="ranking-link-button" href="/ranking">랭킹 확인하기 <span aria-hidden="true">→</span></Link>
          </div>
          <BurgerArtwork />
        </section>
      )}

      {phase === 'playing' && contestants.length >= 2 && (
        <MatchScreen contestants={contestants} matchIndex={matchIndex} completedMatches={roundWinners.length} onSelect={selectBurger} onExit={resetToSetup} />
      )}

      {phase === 'finished' && winner && (
        <ResultScreen winner={winner} roundSize={roundSize} saveStatus={saveStatus} onRetrySave={() => lastPayload && void saveResult(lastPayload)} onReplay={() => startGame(roundSize)} onReset={resetToSetup} />
      )}

      <footer className="site-footer"><span>© 2026 BURGER PICK</span><span>취향에는 정답이 없습니다.</span></footer>
    </main>
  );
}

function MatchScreen({ contestants, matchIndex, completedMatches, onSelect, onExit }: { contestants: Burger[]; matchIndex: number; completedMatches: number; onSelect: (burger: Burger) => void; onExit: () => void }) {
  const left = contestants[matchIndex];
  const right = contestants[matchIndex + 1];
  const totalMatches = contestants.length / 2;
  const currentMatch = completedMatches + 1;
  const progress = ((currentMatch - 1) / totalMatches) * 100;

  return (
    <section className="match-screen" aria-labelledby="match-title">
      <div className="match-heading">
        <div><span className="round-tag">{roundLabel(contestants.length)}</span><h1 id="match-title">더 끌리는 버거는?</h1></div>
        <div className="match-counter"><strong>{String(currentMatch).padStart(2, '0')}</strong><span>/ {String(totalMatches).padStart(2, '0')} MATCH</span></div>
      </div>
      <div className="progress-track" aria-label={`${totalMatches}경기 중 ${currentMatch}경기`}><span style={{ width: `${progress}%` }} /></div>

      <div className="versus-stage">
        <BurgerCard burger={left} side="A" onSelect={onSelect} />
        <div className="vs-divider"><span>VS</span></div>
        <BurgerCard burger={right} side="B" onSelect={onSelect} />
      </div>

      <div className="match-help"><span>마음이 가는 버거 카드를 클릭하세요.</span><button type="button" onClick={onExit}>처음으로 돌아가기</button></div>
    </section>
  );
}

function BurgerCard({ burger, side, onSelect }: { burger: Burger; side: 'A' | 'B'; onSelect: (burger: Burger) => void }) {
  return (
    <button className="burger-card" type="button" onClick={() => onSelect(burger)} style={{ '--accent': burger.accent } as React.CSSProperties}>
      <span className="card-number">OPTION {side}</span>
      <span className="burger-photo" aria-hidden="true"><i>{burger.emoji}</i><b>🍔</b></span>
      <span className="card-copy"><small>{burger.brand}</small><strong>{burger.name}</strong><em>{burger.description}</em><span>이 버거 선택하기 <b>→</b></span></span>
    </button>
  );
}

function ResultScreen({ winner, roundSize, saveStatus, onRetrySave, onReplay, onReset }: { winner: Burger; roundSize: RoundSize; saveStatus: SaveStatus; onRetrySave: () => void; onReplay: () => void; onReset: () => void }) {
  return (
    <section className="result-screen" aria-labelledby="result-title" aria-live="polite">
      <div className="confetti" aria-hidden="true">
        {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
      </div>

      <div className="winner-visual" style={{ '--accent': winner.accent } as React.CSSProperties}>
        <span className="winner-ring ring-one" /><span className="winner-ring ring-two" />
        <span className="crown" aria-hidden="true">♛</span>
        <span className="winner-burger" aria-hidden="true">🍔</span>
        <span className="winner-flavor" aria-hidden="true">{winner.emoji}</span>
        <span className="winner-seal">MY<br />NO.1</span>
      </div>

      <div className="winner-copy">
        <span className="winner-label">TOURNAMENT WINNER</span>
        <h1 id="result-title">당신의<br /><strong>최애 버거</strong>는</h1>
        <div className="winner-name"><small>{winner.brand}</small><h2>{winner.name}</h2><p>{winner.description}</p></div>
        <SaveStatusNotice status={saveStatus} onRetry={onRetrySave} />
        <Link className="ranking-link-button" href="/ranking">랭킹 확인하기 <span aria-hidden="true">→</span></Link>
        <div className="result-actions">
          <button className="replay-button" type="button" onClick={onReplay}><span>{roundSize}강 다시 하기</span><b>↻</b></button>
          <button className="reset-button" type="button" onClick={onReset}>다른 강수 선택하기</button>
        </div>
      </div>
    </section>
  );
}

function SaveStatusNotice({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  if (status === 'idle') return null;
  return (
    <p className={`worldcup-save ${status}`} aria-live="polite">
      {status === 'saving' && <span>기록을 저장하는 중...</span>}
      {status === 'saved' && <><span>기록이 저장되고 랭킹에 반영됐어요.</span><Link href="/mypage?tab=worldcup">마이페이지에서 보기 →</Link></>}
      {status === 'error' && <><span>기록을 저장하지 못했어요.</span><button type="button" onClick={onRetry}>다시 시도</button></>}
      {status === 'guest' && <><span>로그인하면 이 결과가 저장되고 랭킹에 반영돼요.</span><Link href={loginHref('/mypage?tab=worldcup')}>로그인하고 저장 →</Link></>}
    </p>
  );
}

function BurgerArtwork() {
  return (
    <div className="hero-visual" aria-hidden="true"><div className="stamp">BEST<br />BURGER</div><div className="burger-halo" /><div className="burger-illustration"><span className="bun bun-top"><i /><i /><i /></span><span className="lettuce" /><span className="cheese" /><span className="patty" /><span className="tomato" /><span className="bun bun-bottom" /></div><span className="versus-badge">VS</span><p>16 BURGERS · ONE WINNER</p></div>
  );
}

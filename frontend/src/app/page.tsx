'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { getWorldcupSession, startWorldcupSession, voteWorldcup, type WorldcupProduct, type WorldcupRoundSize, type WorldcupSession } from '@/lib/worldcupSession';

type WorldcupOptions = {
  eligibleProductCount: number;
  roundOptions: { roundSize: WorldcupRoundSize; available: boolean }[];
};

function parseOptions(value: unknown): WorldcupOptions {
  const data = value as WorldcupOptions | null;
  if (!data || !Number.isSafeInteger(data.eligibleProductCount) || data.eligibleProductCount < 0 ||
    !Array.isArray(data.roundOptions) || data.roundOptions.length !== 2 ||
    !([8, 16] as const).every((size) => data.roundOptions.some((option) =>
      option?.roundSize === size && typeof option.available === 'boolean' &&
      option.available === (data.eligibleProductCount >= size)))) {
    throw new Error('참가 옵션 응답을 확인할 수 없습니다. 다시 시도해 주세요.');
  }
  return data;
}

const ACTIVE_KEY = 'bp_active_worldcup_session';
const START_KEY = 'bp_worldcup_start_request';
const roundLabel = (size: number) => size === 2 ? '결승' : `${size}강`;
function store(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Continue when storage is unavailable. */ } }
function remove(key: string) { try { localStorage.removeItem(key); } catch { /* Storage is optional. */ } }
function read(key: string): any { try { return JSON.parse(localStorage.getItem(key) ?? 'null'); } catch { return null; } }

export default function HomePage() {
  const router = useRouter();
  const [roundSize, setRoundSize] = useState<WorldcupRoundSize>(8);
  const [session, setSession] = useState<WorldcupSession | null>(null);
  const [options, setOptions] = useState<WorldcupOptions | null>(null);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsRequest, setOptionsRequest] = useState(0);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState<'restore' | 'start' | 'vote' | null>(null);
  const pendingStart = useRef<{ roundSize: WorldcupRoundSize; requestKey: string } | null>(null);
  const pendingVote = useRef<{ sessionId: string; matchId: string; productId: string } | null>(null);
  const activeId = useRef<string | null>(null);
  const inFlight = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const apply = (value: WorldcupSession) => {
    activeId.current = value.sessionId;
    store(ACTIVE_KEY, value.sessionId);
    setRoundSize(value.roundSize);
    setSession(value);
    setError(null);
    setRetry(null);
  };

  useEffect(() => {
    const abort = new AbortController();
    const timeout = window.setTimeout(() => abort.abort(), 10000);
    let disposed = false;
    setOptionsLoading(true);
    setOptionsError(null);
    void (async () => {
      try {
        const response = await fetch('/api/worldcup/options', { cache: 'no-store', signal: abort.signal });
        if (!response.ok) throw new Error('참가 옵션을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
        const data = parseOptions(await response.json());
        if (disposed) return;
        setOptions(data);
        setRoundSize((current) => data.roundOptions.some((option) => option.roundSize === current && option.available)
          ? current : data.roundOptions.find((option) => option.available)?.roundSize ?? 8);
      } catch (cause) {
        if (!disposed) { setOptions(null); setOptionsError(abort.signal.aborted ? '조회 시간이 초과되었습니다. 다시 시도해 주세요.' : cause instanceof Error ? cause.message : '참가 옵션을 불러오지 못했습니다.'); }
      } finally { window.clearTimeout(timeout); if (!disposed) setOptionsLoading(false); }
    })();
    return () => { disposed = true; window.clearTimeout(timeout); abort.abort(); };
  }, [optionsRequest]);

  useEffect(() => {
    let disposed = false;
    const abort = new AbortController();
    controller.current = abort;
    inFlight.current = true;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    void (async () => {
      try {
        const saved = read(ACTIVE_KEY);
        const pending = read(START_KEY);
        if (typeof saved === 'string' && /^[0-9a-f-]{36}$/i.test(saved)) activeId.current = saved;
        if (pending && [8, 16].includes(pending.roundSize) && typeof pending.requestKey === 'string' && /^[0-9a-f-]{36}$/i.test(pending.requestKey)) {
          pendingStart.current = pending;
          const started = await startWorldcupSession(pending.roundSize, pending.requestKey, abort.signal);
          activeId.current = started.sessionId;
          store(ACTIVE_KEY, started.sessionId);
          remove(START_KEY);
          pendingStart.current = null;
        }
        if (activeId.current) {
          const value = await getWorldcupSession(activeId.current, abort.signal);
          if (!disposed) apply(value);
        }
      } catch (cause) {
        if (!disposed) { setError(abort.signal.aborted ? '진행 상황 조회 시간이 초과되었습니다. 다시 시도해 주세요.' : cause instanceof Error ? cause.message : '진행 상황을 불러오지 못했습니다.'); setRetry(pendingStart.current ? 'start' : 'restore'); }
      } finally {
        window.clearTimeout(timeout);
        if (!disposed) { inFlight.current = false; setBusy(false); }
      }
    })();
    return () => { disposed = true; abort.abort(); window.clearTimeout(timeout); };
  }, []);

  const run = async (kind: 'start' | 'restore' | 'vote', work: (signal: AbortSignal) => Promise<WorldcupSession>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const abort = new AbortController();
    controller.current = abort;
    const timeout = window.setTimeout(() => abort.abort(), 15000);
    try { const value = await work(abort.signal); if (!abort.signal.aborted) apply(value); }
    catch (cause) { if (controller.current === abort) { setError(abort.signal.aborted ? '응답 시간이 초과되었습니다. 다시 시도해 주세요.' : cause instanceof Error ? cause.message : '요청을 처리하지 못했습니다.'); setRetry(kind); } }
    finally { window.clearTimeout(timeout); if (controller.current === abort) { inFlight.current = false; setBusy(false); } }
  };
  useEffect(() => () => { controller.current?.abort(); controller.current = null; }, []);

  const available = (size: WorldcupRoundSize) => !optionsLoading && !optionsError && Boolean(options?.roundOptions.some((option) => option.roundSize === size && option.available));
  const start = (size = roundSize, fresh = false) => {
    if (inFlight.current || (!available(size) && !pendingStart.current)) return;
    if (fresh || !pendingStart.current || pendingStart.current.roundSize !== size) pendingStart.current = { roundSize: size, requestKey: crypto.randomUUID() };
    const pending = pendingStart.current;
    store(START_KEY, pending);
    void run('start', async (signal) => {
      const value = await startWorldcupSession(pending.roundSize, pending.requestKey, signal);
      activeId.current = value.sessionId;
      store(ACTIVE_KEY, value.sessionId);
      pendingStart.current = null;
      remove(START_KEY);
      // A replayed creation response is an initial snapshot; always obtain current state.
      return getWorldcupSession(value.sessionId, signal);
    });
  };
  const restore = () => {
    if (activeId.current) void run('restore', (signal) => getWorldcupSession(activeId.current!, signal));
  };
  const select = (product: WorldcupProduct) => {
    if (!session?.currentMatch || inFlight.current || pendingVote.current) return;
    pendingVote.current = { sessionId: session.sessionId, matchId: session.currentMatch.id, productId: product.productId };
    submitVote();
  };
  const submitVote = () => {
    const pending = pendingVote.current;
    if (!pending) return;
    void run('vote', async (signal) => {
      const value = await voteWorldcup(pending.sessionId, pending.matchId, pending.productId, signal);
      pendingVote.current = null;
      return value;
    });
  };
  const reset = () => {
    if (inFlight.current) return;
    if (session?.status === 'IN_PROGRESS' && !window.confirm('강수 선택 화면으로 돌아갈까요? 새 게임을 시작하기 전까지 현재 진행 상황을 다시 불러올 수 있습니다.')) return;
    setSession(null);
    setError(null);
    setRetry(null);
    pendingVote.current = null;
    setOptionsRequest((value) => value + 1);
  };
  const abandonLocal = () => { remove(ACTIVE_KEY); remove(START_KEY); activeId.current = null; pendingStart.current = null; pendingVote.current = null; setSession(null); setError(null); setRetry(null); };
  const retryRequest = () => { if (retry === 'vote') submitVote(); else if (pendingStart.current) start(pendingStart.current.roundSize); else restore(); };
  const navigate = (menu: 'worldcup' | 'recommend' | 'compare') => {
    if (busy) return;
    if (menu === 'worldcup') reset();
    else if (session?.status !== 'IN_PROGRESS' || window.confirm('현재 진행 상황은 저장되어 있습니다. 다른 화면으로 이동할까요?')) router.push(menu === 'compare' ? '/compare' : '/recommend');
  };

  return (
    <main className="worldcup-shell">
      <SiteHeader activeMenu="worldcup" onSelectMenu={navigate} />
      {error && <div className="worldcup-request-status" role="alert"><p>{error}</p><button type="button" disabled={busy} onClick={retryRequest}>다시 시도</button>{retry !== 'vote' && <button type="button" disabled={busy} onClick={abandonLocal}>새로 시작하기</button>}</div>}
      {!session && <section className="start-screen" aria-labelledby="start-title">
        <div className="hero-copy">
          <span className="eyebrow">THE ULTIMATE BURGER TOURNAMENT</span>
          <h1 id="start-title">오늘의 최애 버거를<strong>직접 골라보세요.</strong></h1>
          <p>고민할 시간은 짧게, 선택은 확실하게.<br />두 버거 중 더 끌리는 하나를 고르면 됩니다.</p>
          <div className="round-picker" aria-label="월드컵 강수 선택"><span>몇 강으로 시작할까요?</span><div className="round-options">
            {([8, 16] as const).map((size) => <button className={roundSize === size && available(size) ? 'round-option selected' : 'round-option'} key={size} type="button" disabled={busy || !available(size)} aria-pressed={roundSize === size && available(size)} onClick={() => setRoundSize(size)}><b>{size}강</b><small>{options && !available(size) ? '참가 수 부족' : size === 8 ? '빠르게 즐기기' : '제대로 즐기기'}</small></button>)}
          </div></div>
          <div className="worldcup-options-status" aria-live="polite">
            {optionsLoading && <p>참가 가능한 강수를 확인하고 있습니다.</p>}
            {optionsError && <div><p role="alert">{optionsError}</p><button type="button" onClick={() => setOptionsRequest((value) => value + 1)}>다시 조회하기</button></div>}
            {options && <p>{options.eligibleProductCount < 8 ? `참가 가능한 버거가 ${options.eligibleProductCount}개입니다. 월드컵에는 최소 8개가 필요합니다.` : `참가 가능한 버거 ${options.eligibleProductCount}개`}</p>}
          </div>
          <button className="start-button" disabled={busy || Boolean(retry) || !available(roundSize)} type="button" onClick={() => start()}>{busy ? '월드컵을 불러오는 중…' : `${roundSize}강 월드컵 시작하기`}<span aria-hidden="true">→</span></button>
          {activeId.current && !retry && <button className="reset-button" type="button" disabled={busy} onClick={restore}>저장된 월드컵 이어하기</button>}
          <Link className="ranking-link-button" href="/ranking">랭킹 확인하기 <span aria-hidden="true">→</span></Link>
        </div><BurgerArtwork />
      </section>}
      {session?.status === 'IN_PROGRESS' && session.currentMatch && <section className="match-screen" aria-labelledby="match-title" aria-busy={busy}>
        <div className="match-heading"><div><span className="round-tag">{roundLabel(session.progress.currentRoundSize!)}</span><h1 id="match-title">더 끌리는 버거는?</h1></div><div className="match-counter"><strong>{String(session.progress.roundMatchNumber).padStart(2, '0')}</strong><span>/ {String(session.progress.roundMatchCount).padStart(2, '0')} MATCH</span></div></div>
        <div className="progress-track" aria-label={`전체 ${session.progress.totalMatches}경기 중 ${session.progress.completedMatches}경기 완료`}><span style={{ width: `${session.progress.completedMatches / session.progress.totalMatches * 100}%` }} /></div>
        <div className="versus-stage"><BurgerCard burger={session.currentMatch.left} side="A" disabled={busy || Boolean(pendingVote.current)} onSelect={select} /><div className="vs-divider"><span>VS</span></div><BurgerCard burger={session.currentMatch.right} side="B" disabled={busy || Boolean(pendingVote.current)} onSelect={select} /></div>
        <div className="match-help"><span role="status">{busy ? '선택을 저장하고 있습니다…' : '마음이 가는 버거 카드를 클릭하세요.'}</span><button type="button" disabled={busy} onClick={reset}>강수 선택으로 돌아가기</button></div>
      </section>}
      {session?.status === 'COMPLETED' && session.winner && <section className="result-screen" aria-labelledby="result-title" aria-live="polite">
        <div className="confetti" aria-hidden="true">{Array.from({ length: 18 }, (_, index) => <i key={index} />)}</div>
        <div className="winner-visual" style={{ '--accent': '#f0b735' } as React.CSSProperties}><span className="winner-ring ring-one" /><span className="winner-ring ring-two" /><span className="crown" aria-hidden="true">♛</span><span className="winner-burger"><ProductImage product={session.winner} /></span><span className="winner-seal">MY<br />NO.1</span></div>
        <div className="winner-copy"><span className="winner-label">TOURNAMENT WINNER</span><h1 id="result-title">당신의<br /><strong>최애 버거</strong>는</h1><div className="winner-name"><small>{session.winner.brandName}</small><h2>{session.winner.name}</h2><p>{session.winner.description}</p></div><p className="worldcup-save saved">우승 결과가 저장됐어요.</p><div className="result-actions"><button className="replay-button" type="button" disabled={busy || Boolean(retry) || !available(session.roundSize)} onClick={() => start(session.roundSize, true)}><span>{busy ? '시작하는 중…' : `${session.roundSize}강 다시 하기`}</span><b>↻</b></button><button className="reset-button" type="button" disabled={busy} onClick={reset}>다른 강수 선택하기</button></div></div>
      </section>}
      {session && ['EXPIRED', 'ABANDONED'].includes(session.status) && <section className="start-screen"><div className="hero-copy"><h1>{session.status === 'EXPIRED' ? '진행 시간이 만료됐어요.' : '종료된 월드컵이에요.'}</h1><p>새로운 월드컵을 시작해 주세요.</p><button className="start-button" type="button" onClick={abandonLocal}>강수 선택하기</button></div></section>}
      <footer className="site-footer"><span>© 2026 BURGER PICK</span><span>취향에는 정답이 없습니다.</span></footer>
    </main>
  );
}

function ProductImage({ product }: { product: WorldcupProduct }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [product.imageUrl]);
  const safeUrl = product.imageUrl && (/^https?:\/\//i.test(product.imageUrl) || (product.imageUrl.startsWith('/') && !product.imageUrl.startsWith('//'))) ? product.imageUrl : null;
  return safeUrl && !failed ? <img src={safeUrl} alt={product.name} onError={() => setFailed(true)} /> : <span aria-hidden="true">🍔</span>;
}

function BurgerCard({ burger, side, disabled, onSelect }: { burger: WorldcupProduct; side: 'A' | 'B'; disabled: boolean; onSelect: (burger: WorldcupProduct) => void }) {
  return <button className="burger-card" type="button" disabled={disabled} onClick={() => onSelect(burger)} style={{ '--accent': side === 'A' ? '#f0b735' : '#d84a30' } as React.CSSProperties}><span className="card-number">OPTION {side}</span><span className="burger-photo"><b><ProductImage product={burger} /></b></span><span className="card-copy"><small>{burger.brandName}</small><strong>{burger.name}</strong><em>{burger.description}</em><span>이 버거 선택하기 <b>→</b></span></span></button>;
}

function BurgerArtwork() {
  return (
    <div className="hero-visual" aria-hidden="true"><div className="stamp">BEST<br />BURGER</div><div className="burger-halo" /><div className="burger-illustration"><span className="bun bun-top"><i /><i /><i /></span><span className="lettuce" /><span className="cheese" /><span className="patty" /><span className="tomato" /><span className="bun bun-bottom" /></div><span className="versus-badge">VS</span><p>BURGER WORLD CUP · ONE WINNER</p></div>
  );
}

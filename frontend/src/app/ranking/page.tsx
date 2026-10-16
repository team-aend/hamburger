'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { RankingsResponse, RankingSort } from '@/data/rankings';

export default function RankingPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RankingSort>('championships');
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [roundSize, setRoundSize] = useState('');
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(false);
    const timer = setTimeout(() => {
      const params = new URLSearchParams({ sort, q: query.trim(), page: String(page), pageSize: '20' });
      if (roundSize) params.set('roundSize', roundSize);
      fetch(`/api/worldcup/rankings?${params}`, { cache: 'no-store', signal: controller.signal })
        .then((res) => res.ok ? res.json() : Promise.reject(new Error()))
        .then((result: RankingsResponse) => {
          if (!controller.signal.aborted) { setData(result); setLoading(false); }
        })
        .catch(() => {
          if (!controller.signal.aborted) { setError(true); setLoading(false); }
        });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [sort, query, roundSize, page, retry]);

  const totalResults = data?.completedSessionCount ?? null;
  const hasResults = (totalResults ?? 0) > 0;
  const leaders = data?.leaders ?? [];
  const filtered = data?.items ?? [];
  const rate = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`;

  return (
    <main className="worldcup-shell ranking-shell">
      <SiteHeader />
      <section className="ranking-content" aria-labelledby="ranking-title">
        <div className="ranking-heading">
          <span className="eyebrow">BURGER PICK · HALL OF FAME</span>
          <h1 id="ranking-title">취향이 모이면,<br /><strong>랭킹이 된다.</strong></h1>
          <p>햄버거 월드컵 랭킹에서 인기 버거를 만나보세요.</p>
        </div>
        <aside className="ranking-notice">
          <strong>실시간 집계</strong>
          <span>
            {error
              ? '랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
              : loading || totalResults === null
                ? '랭킹을 불러오는 중입니다...'
                : `완료된 실제 상품 월드컵 ${totalResults.toLocaleString()}회의 결과로 집계합니다.`}
          </span>
        </aside>
          <div className="ranking-controls ranking-controls-top">
            <label>버거 이름 검색<input type="search" placeholder="어떤 버거가 궁금하세요?" maxLength={100} value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} /></label>
            <label>정렬 기준<select value={sort} onChange={(event) => { setSort(event.target.value as RankingSort); setPage(1); }}><option value="championships">우승 횟수 높은 순</option><option value="winRate">대결 승률 높은 순</option></select></label>
            <label>월드컵 범위<select value={roundSize} onChange={(event) => { setRoundSize(event.target.value); setPage(1); }}><option value="">전체</option><option value="8">8강</option><option value="16">16강</option></select></label>
          </div>

        {error && <button type="button" className="ranking-retry" onClick={() => setRetry((value) => value + 1)}>다시 시도</button>}

        {!loading && !error && totalResults !== null && !hasResults ? (
          <div className="ranking-empty">
            <h3>아직 집계된 결과가 없어요.</h3>
            <p>첫 번째 월드컵 기록을 남겨 랭킹을 시작해 보세요.</p>
            <Link className="start-button ranking-empty-start" href="/">월드컵 참여하기 <span aria-hidden="true">→</span></Link>
          </div>
        ) : !loading && !error && hasResults && (<>

        <section aria-labelledby="leaders-title">
          <h2 id="leaders-title" className="ranking-section-title">TOP 3 <small>{sort === 'championships' ? '우승 횟수' : '대결 승률'} 기준 · 공동 순위 포함</small></h2>
          <div className="ranking-leaders">
            {leaders.map((entry) => (
              <article className={`ranking-leader ${entry.rank === 1 ? 'first' : ''}`} key={entry.productId}>
                <span className="ranking-position">{entry.rank}위</span>
                <div className="ranking-art" aria-hidden="true">🍔</div>
                <small>{entry.brandName}</small><h3><Link className="ranking-product-link" href={`/products/${entry.productId}`}>{entry.name}</Link></h3>
                <p>우승 <strong>{entry.championships}회</strong><span>대결 승률 {rate(entry.winRate)}</span></p>
              </article>
            ))}
          </div>
        </section>

        <section className="ranking-list-section" aria-labelledby="all-rankings-title">
          <h2 id="all-rankings-title" className="ranking-section-title">전체 순위 <small>{data?.totalCount} BURGERS</small></h2>
          <p className="ranking-count" aria-live="polite">{data?.totalCount}개의 버거 · 검색해도 전체 순위는 유지됩니다.</p>
          {filtered.length ? (
            <table className="ranking-table">
              <caption className="visually-hidden">햄버거 월드컵 랭킹, {sort === 'championships' ? '우승 횟수' : '대결 승률'} 내림차순</caption>
              <thead><tr><th scope="col">순위</th><th scope="col">버거</th><th scope="col">우승 횟수</th><th scope="col">대결 승률</th></tr></thead>
              <tbody>{filtered.map((entry) => (
                <tr key={entry.productId}><td className="ranking-number">{entry.rank ?? '—'}</td><th scope="row"><div className="ranking-burger"><span aria-hidden="true">🍔</span><div><small>{entry.brandName}</small><strong><Link className="ranking-product-link" href={`/products/${entry.productId}`}>{entry.name}</Link></strong>{entry.status !== 'ACTIVE' && <small>판매 중단</small>}</div></div></th><td>{entry.championships}회</td><td>{rate(entry.winRate)}</td></tr>
              ))}</tbody>
            </table>
          ) : <div className="ranking-empty"><h3>검색한 버거가 없습니다.</h3><p>다른 이름으로 검색해 보세요.</p><button type="button" onClick={() => { setQuery(''); setPage(1); }}>검색 초기화</button></div>}
          <nav className="ranking-pagination" aria-label="랭킹 페이지">
            <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}><span aria-hidden="true">←</span> 이전</button>
            <span className="ranking-page-count"><strong>{page}</strong> / {Math.max(1, Math.ceil((data?.totalCount ?? 0) / 20))}</span>
            <button type="button" disabled={page * 20 >= (data?.totalCount ?? 0)} onClick={() => setPage(page + 1)}>다음 <span aria-hidden="true">→</span></button>
          </nav>
          <p className="ranking-definition">1회 이상 우승한 버거만 표시합니다. 우승 횟수는 최종 우승 수, 대결 승률은 전체 대결 중 승리한 비율입니다. 같은 수치는 공동 순위로 표시합니다.</p>
        </section>
        </>)}
        <div className="ranking-cta"><h2>당신의 1위는 누구인가요?</h2><Link className="start-button" href="/">월드컵 참여하기 <span aria-hidden="true">→</span></Link></div>
      </section>
      <footer className="site-footer"><span>© 2026 BURGER PICK</span><span>취향에는 정답이 없습니다.</span></footer>
    </main>
  );
}

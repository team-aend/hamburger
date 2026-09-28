'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import SiteHeader from '@/components/SiteHeader';
import { BurgerStat, getRankings, RankingSort } from '@/data/rankings';

export default function RankingPage() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<RankingSort>('championships');
  const [stats, setStats] = useState<BurgerStat[]>([]);
  const [totalResults, setTotalResults] = useState<number | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/worldcup/rankings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { totalResults: number; stats: BurgerStat[] }) => {
        setStats(data.stats);
        setTotalResults(data.totalResults);
      })
      .catch(() => setError(true));
  }, []);

  const rankings = getRankings(stats, sort);
  const hasResults = (totalResults ?? 0) > 0;
  const leaders = rankings.filter((entry) => entry.rank <= 3);
  const filtered = rankings.filter((entry) => entry.name.includes(query.trim()));

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
              : totalResults === null
                ? '랭킹을 불러오는 중입니다...'
                : `로그인 회원이 완주한 월드컵 ${totalResults.toLocaleString()}회의 결과로 집계합니다.`}
          </span>
        </aside>

        {totalResults !== null && !hasResults ? (
          <div className="ranking-empty">
            <h3>아직 집계된 결과가 없어요.</h3>
            <p>첫 번째 월드컵 기록을 남겨 랭킹을 시작해 보세요.</p>
            <Link className="start-button ranking-empty-start" href="/">월드컵 참여하기 <span aria-hidden="true">→</span></Link>
          </div>
        ) : hasResults && (<>

        <section aria-labelledby="leaders-title">
          <h2 id="leaders-title" className="ranking-section-title">TOP 3 <small>{sort === 'championships' ? '우승 횟수' : '대결 승률'} 기준 · 공동 순위 포함</small></h2>
          <div className="ranking-leaders">
            {leaders.map((entry) => (
              <article className={`ranking-leader ${entry.rank === 1 ? 'first' : ''}`} key={entry.id}>
                <span className="ranking-position">{entry.rank}위</span>
                <div className="ranking-art" style={{ backgroundColor: entry.accent }} aria-hidden="true">🍔<span>{entry.emoji}</span></div>
                <small>{entry.brand}</small><h3>{entry.name}</h3>
                <p>우승 <strong>{entry.championships}회</strong><span>대결 승률 {entry.winRate.toFixed(1)}%</span></p>
              </article>
            ))}
          </div>
        </section>

        <section className="ranking-list-section" aria-labelledby="all-rankings-title">
          <h2 id="all-rankings-title" className="ranking-section-title">전체 순위 <small>16 BURGERS</small></h2>
          <div className="ranking-controls">
            <label>버거 이름 검색<input type="search" placeholder="어떤 버거가 궁금하세요?" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label>정렬 기준<select value={sort} onChange={(event) => setSort(event.target.value as RankingSort)}><option value="championships">우승 횟수 높은 순</option><option value="winRate">대결 승률 높은 순</option></select></label>
          </div>
          <p className="ranking-count" aria-live="polite">{filtered.length}개의 버거 · 검색해도 전체 순위는 유지됩니다.</p>
          {filtered.length ? (
            <table className="ranking-table">
              <caption className="visually-hidden">햄버거 월드컵 랭킹, {sort === 'championships' ? '우승 횟수' : '대결 승률'} 내림차순</caption>
              <thead><tr><th scope="col">순위</th><th scope="col">버거</th><th scope="col">우승 횟수</th><th scope="col">대결 승률</th></tr></thead>
              <tbody>{filtered.map((entry) => (
                <tr key={entry.id}><td className="ranking-number">{entry.rank}</td><th scope="row"><div className="ranking-burger"><span aria-hidden="true" style={{ backgroundColor: entry.accent }}>{entry.emoji}</span><div><small>{entry.brand}</small><strong>{entry.name}</strong></div></div></th><td>{entry.championships}회</td><td>{entry.winRate.toFixed(1)}%</td></tr>
              ))}</tbody>
            </table>
          ) : <div className="ranking-empty"><h3>검색한 버거가 없습니다.</h3><p>다른 이름으로 검색해 보세요.</p><button type="button" onClick={() => setQuery('')}>검색 초기화</button></div>}
          <p className="ranking-definition">우승 횟수는 최종 우승 수, 대결 승률은 전체 대결 중 승리한 비율입니다. 같은 수치는 공동 순위로 표시합니다.</p>
        </section>
        </>)}
        <div className="ranking-cta"><h2>당신의 1위는 누구인가요?</h2><Link className="start-button" href="/">월드컵 참여하기 <span aria-hidden="true">→</span></Link></div>
      </section>
      <footer className="site-footer"><span>© 2026 BURGER PICK</span><span>취향에는 정답이 없습니다.</span></footer>
    </main>
  );
}

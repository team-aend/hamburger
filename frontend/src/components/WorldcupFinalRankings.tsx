'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { RankingsResponse } from '@/data/rankings';

/** Mounted only after the server has committed a completed session. */
export default function WorldcupFinalRankings({ sessionId, winnerProductId }: {
  sessionId: string;
  winnerProductId: string;
}) {
  const [data, setData] = useState<RankingsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;
    const timeout = setTimeout(() => controller.abort(), 10000);
    setLoading(true);
    setError(false);
    fetch(`/api/worldcup/rankings?sort=championships&page=${page}&pageSize=20`, {
      cache: 'no-store', signal: controller.signal,
    })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error()))
      .then((result: RankingsResponse) => {
        if (!disposed) { setData(result); setLoading(false); }
      })
      .catch(() => {
        if (!disposed) { setError(true); setLoading(false); }
      })
      .finally(() => clearTimeout(timeout));
    return () => { disposed = true; clearTimeout(timeout); controller.abort(); };
  }, [sessionId, page, retry]);

  return <section className="final-rankings ranking-list-section" aria-labelledby="final-rankings-title" aria-busy={loading}>
    <div className="final-rankings-heading">
      <div><span className="eyebrow">BURGER PICK · HALL OF FAME</span><h2 id="final-rankings-title">월드컵 최종 우승 랭킹</h2></div>
      <Link className="ranking-link-button" href="/ranking">전체 랭킹 검색하기 <span aria-hidden="true">→</span></Link>
    </div>
    <p>완료한 모든 월드컵에서 1회 이상 우승한 버거만 표시합니다. 같은 우승 횟수는 공동 순위입니다.</p>
    {loading ? <p role="status">방금 완료한 결과를 포함한 랭킹을 불러오고 있습니다…</p>
      : error ? <div role="alert"><p>랭킹을 불러오지 못했습니다. 다시 시도해 주세요.</p><button type="button" className="reset-button" onClick={() => setRetry((value) => value + 1)}>다시 조회하기</button></div>
      : data && <>
        <p className="ranking-count">월드컵 {data.completedSessionCount.toLocaleString()}회 · 버거 {data.totalCount.toLocaleString()}개</p>
        {data.items.length ? <div className="final-rankings-table"><table className="ranking-table">
          <caption className="visually-hidden">최종 우승 횟수 내림차순 랭킹</caption>
          <thead><tr><th scope="col">순위</th><th scope="col">버거</th><th scope="col">우승 횟수</th><th scope="col">참가 횟수</th><th scope="col">대결 승률</th></tr></thead>
          <tbody>{data.items.map((item) => <tr key={item.productId} className={item.productId === winnerProductId ? 'my-worldcup-winner' : undefined}>
            <td className="ranking-number">{item.rank ?? '—'}</td>
            <th scope="row"><div className="ranking-burger"><span aria-hidden="true" style={{ overflow: 'hidden' }}>{item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8 }} /> : '🍔'}</span><div><small>{item.brandName}</small><strong>{item.name}</strong>{item.productId === winnerProductId && <small className="final-winner-label">이번 월드컵 우승</small>}{item.status !== 'ACTIVE' && <small>판매 중단</small>}</div></div></th>
            <td>{item.championships.toLocaleString()}회</td><td>{item.appearances.toLocaleString()}회</td><td>{item.winRate === null ? '—' : `${item.winRate.toFixed(1)}%`}</td>
          </tr>)}</tbody>
        </table></div> : <p>조회된 랭킹이 없습니다.</p>}
        <nav className="final-rankings-pagination ranking-pagination" aria-label="최종 우승 랭킹 페이지">
          <button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><span aria-hidden="true">←</span> 이전</button>
          <span className="ranking-page-count"><strong>{page}</strong> / {Math.max(1, Math.ceil(data.totalCount / data.pageSize))}</span>
          <button type="button" disabled={page * data.pageSize >= data.totalCount} onClick={() => setPage((value) => value + 1)}>다음 <span aria-hidden="true">→</span></button>
        </nav>
      </>}
  </section>;
}

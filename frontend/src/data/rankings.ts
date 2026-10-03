import type { WorldcupProduct } from '@/lib/worldcupSession';

export type RankingSort = 'championships' | 'winRate';

/** /api/worldcup/rankings 응답의 버거별 집계 (완료된 실제 상품 세션) */
export interface ProductStat extends WorldcupProduct {
  championships: number;
  matches: number;
  wins: number;
}

export function getRankings(stats: ProductStat[], sort: RankingSort) {
  const entries = stats.map((stat) => ({
    ...stat, winRate: stat.matches === 0 ? 0 : stat.wins / stat.matches * 100,
  }));

  const sorted = entries.sort((a, b) => b[sort] - a[sort] || a.productId.localeCompare(b.productId));
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry[sort] !== sorted[index - 1][sort]) rank = index + 1;
    return { ...entry, rank };
  });
}

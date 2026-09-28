import { burgers } from './burgers';

export type RankingSort = 'championships' | 'winRate';

/** /api/worldcup/rankings 응답의 버거별 집계 (로그인 회원의 월드컵 결과) */
export interface BurgerStat {
  burgerId: string;
  championships: number;
  matches: number;
  wins: number;
}

export function getRankings(stats: BurgerStat[], sort: RankingSort) {
  const statById = new Map(stats.map((stat) => [stat.burgerId, stat]));
  // 아직 한 번도 나오지 않은 버거도 0으로 순위표에 포함한다.
  const entries = burgers.map((burger) => {
    const { championships = 0, matches = 0, wins = 0 } = statById.get(burger.id) ?? {};
    return { ...burger, championships, matches, wins, winRate: matches === 0 ? 0 : wins / matches * 100 };
  });

  const sorted = entries.sort((a, b) => b[sort] - a[sort] || a.id.localeCompare(b.id));
  let rank = 0;
  return sorted.map((entry, index) => {
    if (index === 0 || entry[sort] !== sorted[index - 1][sort]) rank = index + 1;
    return { ...entry, rank };
  });
}

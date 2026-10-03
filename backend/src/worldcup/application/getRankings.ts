export interface RankingsInput {
  sort: 'championships' | 'winRate';
  roundSize: 8 | 16 | null;
  q: string;
  page: number;
  pageSize: number;
}
export interface RankingItem {
  productId: string;
  name: string;
  brandName: string;
  imageUrl: string | null;
  status: string;
  rank: number | null;
  championships: number;
  appearances: number;
  matches: number;
  wins: number;
  winRate: number | null;
}
export interface RankingsResult {
  sort: RankingsInput['sort'];
  roundSize: RankingsInput['roundSize'];
  page: number;
  pageSize: number;
  totalCount: number;
  completedSessionCount: number;
  leaders: RankingItem[];
  items: RankingItem[];
}
export interface RankingsRepository {
  read(input: RankingsInput): Promise<RankingsResult>;
}
export const createGetRankings = (repository: RankingsRepository) =>
  (input: RankingsInput) => repository.read(input);

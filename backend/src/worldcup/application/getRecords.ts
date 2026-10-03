import type { WorldcupProduct, RoundSize } from '../domain/session.js';

export interface ProductStat extends WorldcupProduct {
  championships: number;
  matches: number;
  wins: number;
}

export interface WorldcupHistory {
  total: number;
  championships: { product: WorldcupProduct; count: number }[];
  results: { sessionId: string; roundSize: RoundSize; winner: WorldcupProduct; createdAt: string }[];
}

export interface WorldcupRecords {
  rankings(): Promise<{ totalResults: number; stats: ProductStat[] }>;
  history(userId: number): Promise<WorldcupHistory>;
}

export function createGetRecords(records: WorldcupRecords) {
  return {
    rankings: () => records.rankings(),
    history: (userId: number) => records.history(userId),
  };
}

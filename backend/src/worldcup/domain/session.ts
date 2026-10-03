export interface WorldcupProduct {
  productId: string;
  name: string;
  brandName: string;
  description: string | null;
  imageUrl: string | null;
}

export type RoundSize = 8 | 16;

export interface WorldcupSessionState {
  sessionId: string;
  status: 'IN_PROGRESS';
  roundSize: RoundSize;
  expiresAt: string;
  progress: {
    completedMatches: number;
    totalMatches: number;
    currentRoundSize: RoundSize;
    roundMatchNumber: number;
    roundMatchCount: number;
  };
  currentMatch: { id: string; left: WorldcupProduct; right: WorldcupProduct };
  winner: null;
}

export function createInitialSession(
  products: WorldcupProduct[],
  roundSize: RoundSize,
  expiresAt: string,
  random: (max: number) => number,
  uuid: () => string,
) {
  const shuffled = [...products];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = random(index + 1);
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  const entries = shuffled.slice(0, roundSize);
  // Product availability is assumed by contract; no additional count validation.
  const matches = Array.from({ length: roundSize / 2 }, (_, index) => ({
    id: uuid(),
    index,
    left: entries[index * 2],
    right: entries[index * 2 + 1],
  }));
  const state: WorldcupSessionState = {
    sessionId: uuid(),
    status: 'IN_PROGRESS',
    roundSize,
    expiresAt,
    progress: {
      completedMatches: 0,
      totalMatches: roundSize - 1,
      currentRoundSize: roundSize,
      roundMatchNumber: 1,
      roundMatchCount: roundSize / 2,
    },
    currentMatch: { id: matches[0].id, left: matches[0].left, right: matches[0].right },
    winner: null,
  };
  return { state, entries, matches };
}

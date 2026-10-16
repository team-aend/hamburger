import type { WorldcupProduct } from './session.js';

export interface DecidedMatch {
  roundSize: number;
  left: WorldcupProduct;
  right: WorldcupProduct;
  winnerProductId: string;
}

export interface WinnerStep {
  /** 16, 8, 4, 2(결승) */
  roundSize: number;
  opponent: WorldcupProduct;
}

/**
 * 우승 버거가 이긴 상대들을 첫 라운드부터 결승까지 순서대로.
 * 우승 버거가 지거나 빠진 라운드가 있으면 그 라운드는 건너뛴다(손상된 기록 방어).
 */
export function winnerPath(matches: DecidedMatch[], winnerProductId: string): WinnerStep[] {
  return matches
    .filter((m) => m.winnerProductId === winnerProductId &&
      (m.left.productId === winnerProductId || m.right.productId === winnerProductId))
    .sort((a, b) => b.roundSize - a.roundSize)
    .map((m) => ({ roundSize: m.roundSize, opponent: m.left.productId === winnerProductId ? m.right : m.left }));
}

import type { WorldcupProduct } from '../domain/session.js';
import { winnerPath, type DecidedMatch, type WinnerStep } from '../domain/share.js';

/** 공유 화면에 보여줄 완료된 월드컵. 누가 했는지(소유자·회원)는 담지 않는다. */
export interface WorldcupShare {
  sessionId: string;
  roundSize: 8 | 16;
  completedAt: string;
  winner: WorldcupProduct;
  path: WinnerStep[];
}

export interface CompletedSessionRecord {
  sessionId: string;
  roundSize: 8 | 16;
  completedAt: string;
  winner: WorldcupProduct;
  matches: DecidedMatch[];
}

export interface WorldcupShareRepository {
  /** 완료된 세션만 돌려준다. 진행 중·만료·포기 세션은 null */
  findCompleted(sessionId: string): Promise<CompletedSessionRecord | null>;
}

export const createGetShare = (repository: WorldcupShareRepository) =>
  async (sessionId: string): Promise<WorldcupShare | null> => {
    const record = await repository.findCompleted(sessionId);
    if (!record) return null;
    return {
      sessionId: record.sessionId,
      roundSize: record.roundSize,
      completedAt: record.completedAt,
      winner: record.winner,
      path: winnerPath(record.matches, record.winner.productId),
    };
  };

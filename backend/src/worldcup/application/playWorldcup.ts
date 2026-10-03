import { decideWinner, viewSession, type StoredSession, type StoredMatch, type WorldcupView } from '../domain/progression.js';

export interface PlayTransaction {
  loadSession(id: string, ownerHash: string, lock: boolean): Promise<StoredSession | undefined>;
  now(): Promise<string>;
  saveDecision(sessionId: string, matchId: string, winnerId: string, decidedAt: string, newMatches: StoredMatch[], completed: boolean): Promise<void>;
}
export interface PlayUnitOfWork {
  transaction<T>(work: (tx: PlayTransaction) => Promise<T>, options?: { readOnly?: boolean }): Promise<T>;
}
export class SessionNotFound extends Error {
  constructor() { super('월드컵을 찾을 수 없습니다.'); }
}

export function createGetSession(uow: PlayUnitOfWork) {
  return (id: string, ownerHash: string): Promise<WorldcupView> => uow.transaction(async (tx) => {
    const session = await tx.loadSession(id, ownerHash, false);
    if (!session) throw new SessionNotFound();
    return viewSession(session, await tx.now());
  }, { readOnly: true });
}

export function createVote(uow: PlayUnitOfWork, uuid: () => string) {
  return (id: string, ownerHash: string, matchId: string, winnerId: string) => uow.transaction(async (tx) => {
    const session = await tx.loadSession(id, ownerHash, true);
    if (!session) throw new SessionNotFound();
    const now = await tx.now();
    const decision = decideWinner(session, matchId, winnerId, now, uuid);
    if (!decision.replayed) await tx.saveDecision(id, matchId, winnerId, now, decision.newMatches, decision.completed);
    return { ...decision.view, replayed: decision.replayed };
  });
}

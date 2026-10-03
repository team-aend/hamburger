import type { RoundSize, WorldcupProduct } from './session.js';

export type SessionStatus = 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
export type MatchRound = RoundSize | 4 | 2;
export interface StoredMatch {
  id: string;
  roundSize: MatchRound;
  index: number;
  leftId: string;
  rightId: string;
  winnerId: string | null;
}
export interface StoredSession {
  sessionId: string;
  roundSize: RoundSize;
  status: SessionStatus;
  expiresAt: string;
  completedAt: string | null;
  winnerId: string | null;
  entries: WorldcupProduct[];
  matches: StoredMatch[];
}
export interface WorldcupView {
  sessionId: string;
  roundSize: RoundSize;
  status: SessionStatus;
  expiresAt: string;
  completedAt: string | null;
  progress: {
    completedMatches: number;
    totalMatches: number;
    currentRoundSize: MatchRound | null;
    roundMatchNumber: number | null;
    roundMatchCount: number | null;
  };
  currentMatch: { id: string; left: WorldcupProduct; right: WorldcupProduct } | null;
  winner: WorldcupProduct | null;
}
export class WorldcupPlayError extends Error {
  constructor(public code: 'INVALID_SESSION_STATE' | 'MATCH_NOT_FOUND' | 'MATCH_ALREADY_DECIDED' |
    'INVALID_WINNER' | 'MATCH_NOT_CURRENT' | 'SESSION_EXPIRED' | 'SESSION_NOT_IN_PROGRESS', message: string) { super(message); }
}

function entry(session: StoredSession, id: string): WorldcupProduct {
  const product = session.entries.find((candidate) => candidate.productId === id);
  if (!product) throw new WorldcupPlayError('INVALID_SESSION_STATE', '월드컵 참가 정보를 확인하지 못했습니다.');
  return product;
}

export function viewSession(session: StoredSession, now: string): WorldcupView {
  const status = session.status === 'IN_PROGRESS' && Date.parse(now) >= Date.parse(session.expiresAt) ? 'EXPIRED' : session.status;
  const completedMatches = session.matches.filter((match) => match.winnerId !== null).length;
  const view: WorldcupView = {
    sessionId: session.sessionId, roundSize: session.roundSize, status, expiresAt: session.expiresAt,
    completedAt: session.completedAt,
    progress: { completedMatches, totalMatches: session.roundSize - 1, currentRoundSize: null, roundMatchNumber: null, roundMatchCount: null },
    currentMatch: null, winner: null,
  };
  if (status === 'COMPLETED') {
    if (!session.winnerId || !session.completedAt || completedMatches !== session.roundSize - 1) {
      throw new WorldcupPlayError('INVALID_SESSION_STATE', '월드컵 완료 정보를 확인하지 못했습니다.');
    }
    view.winner = entry(session, session.winnerId);
  } else if (status === 'IN_PROGRESS') {
    const round = Math.min(...session.matches.map((match) => match.roundSize)) as MatchRound;
    const matches = session.matches.filter((match) => match.roundSize === round).sort((a, b) => a.index - b.index);
    const current = matches.find((match) => match.winnerId === null);
    if (!current || matches.length !== round / 2) {
      throw new WorldcupPlayError('INVALID_SESSION_STATE', '현재 대진을 확인하지 못했습니다.');
    }
    view.progress.currentRoundSize = round;
    view.progress.roundMatchNumber = current.index + 1;
    view.progress.roundMatchCount = round / 2;
    view.currentMatch = { id: current.id, left: entry(session, current.leftId), right: entry(session, current.rightId) };
  }
  return view;
}

export function decideWinner(session: StoredSession, matchId: string, winnerId: string, now: string, uuid: () => string) {
  const match = session.matches.find((candidate) => candidate.id === matchId);
  if (!match) throw new WorldcupPlayError('MATCH_NOT_FOUND', '경기를 찾을 수 없습니다.');
  if (match.winnerId !== null) {
    if (match.winnerId !== winnerId) throw new WorldcupPlayError('MATCH_ALREADY_DECIDED', '이미 다른 버거가 선택된 경기입니다.');
    return { replayed: true, view: viewSession(session, now), newMatches: [] as StoredMatch[], completed: false };
  }
  const current = viewSession(session, now);
  if (current.status === 'EXPIRED') throw new WorldcupPlayError('SESSION_EXPIRED', '월드컵 진행 시간이 만료되었습니다.');
  if (current.status !== 'IN_PROGRESS') throw new WorldcupPlayError('SESSION_NOT_IN_PROGRESS', '진행 중인 월드컵이 아닙니다.');
  if (current.currentMatch?.id !== matchId) throw new WorldcupPlayError('MATCH_NOT_CURRENT', '현재 경기부터 선택해 주세요.');
  if (winnerId !== match.leftId && winnerId !== match.rightId) throw new WorldcupPlayError('INVALID_WINNER', '현재 경기의 버거를 선택해 주세요.');
  const updated: StoredSession = { ...session, matches: session.matches.map((candidate) => candidate.id === matchId ? { ...candidate, winnerId } : candidate) };
  const round = updated.matches.filter((candidate) => candidate.roundSize === match.roundSize).sort((a, b) => a.index - b.index);
  const newMatches: StoredMatch[] = [];
  let completed = false;
  if (round.every((candidate) => candidate.winnerId !== null)) {
    if (match.roundSize === 2) {
      updated.status = 'COMPLETED';
      updated.winnerId = winnerId;
      updated.completedAt = now;
      completed = true;
    } else {
      const nextRound = match.roundSize / 2 as MatchRound;
      for (let i = 0; i < round.length; i += 2) {
        newMatches.push({ id: uuid(), roundSize: nextRound, index: i / 2,
          leftId: round[i].winnerId!, rightId: round[i + 1].winnerId!, winnerId: null });
      }
      updated.matches = [...updated.matches, ...newMatches];
    }
  }
  return { replayed: false, view: viewSession(updated, now), newMatches, completed };
}

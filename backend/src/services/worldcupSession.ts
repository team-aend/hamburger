import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { WorldcupProduct } from '../repositories/worldcupProducts.js';

export type RoundSize = 8 | 16;

export class WorldcupSessionError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export interface StartWorldcupInput {
  roundSize: RoundSize;
  requestKey: string;
  ownerHash: string;
}

export interface WorldcupSessionResponse {
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

export function validateStartWorldcup(body: unknown, key: unknown): { roundSize: RoundSize; requestKey: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((field) => field !== 'roundSize')) {
    throw new WorldcupSessionError(400, 'INVALID_REQUEST_BODY', 'roundSize만 포함한 JSON 객체를 전달해 주세요.');
  }
  const roundSize = (body as { roundSize?: unknown }).roundSize;
  if (roundSize !== 8 && roundSize !== 16) {
    throw new WorldcupSessionError(400, 'INVALID_ROUND_SIZE', 'roundSize는 8 또는 16이어야 합니다.');
  }
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new WorldcupSessionError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key에 UUID를 전달해 주세요.');
  }
  return { roundSize, requestKey: key.toLowerCase() };
}

export function hashStartBody(roundSize: RoundSize): string {
  return createHash('sha256').update(JSON.stringify({ roundSize })).digest('hex');
}

export function sessionLifetimeSeconds(): number {
  const configured = process.env.WORLDCUP_SESSION_TTL_SECONDS;
  if (configured === undefined) return 24 * 60 * 60;
  const value = Number(configured);
  if (!Number.isSafeInteger(value) || value <= 0 || value > 30 * 24 * 60 * 60) {
    throw new Error('Invalid WORLDCUP_SESSION_TTL_SECONDS');
  }
  return value;
}

export function prepareWorldcup(
  products: WorldcupProduct[],
  roundSize: RoundSize,
  expiresAt: string,
  random: (max: number) => number = randomInt,
  uuid: () => string = randomUUID,
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
  const response: WorldcupSessionResponse = {
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
  return { response, entries, matches };
}

import type { RoundSize } from '../domain/session.js';

export class WorldcupHttpError extends Error {
  constructor(public status: number, public code: string, message: string, public retryAfter?: number) {
    super(message);
  }
}

export function validateStartWorldcup(body: unknown, key: unknown): { roundSize: RoundSize; requestKey: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).some((field) => field !== 'roundSize')) {
    throw new WorldcupHttpError(400, 'INVALID_REQUEST_BODY', 'roundSize만 포함한 JSON 객체를 전달해 주세요.');
  }
  const roundSize = (body as { roundSize?: unknown }).roundSize;
  if (roundSize !== 8 && roundSize !== 16) {
    throw new WorldcupHttpError(400, 'INVALID_ROUND_SIZE', 'roundSize는 8 또는 16이어야 합니다.');
  }
  if (typeof key !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new WorldcupHttpError(400, 'INVALID_IDEMPOTENCY_KEY', 'Idempotency-Key에 UUID를 전달해 주세요.');
  }
  return { roundSize, requestKey: key.toLowerCase() };
}


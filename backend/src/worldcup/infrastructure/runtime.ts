import { createHash, randomInt, randomUUID } from 'node:crypto';
import type { RoundSize } from '../domain/session.js';

export { randomInt, randomUUID };

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


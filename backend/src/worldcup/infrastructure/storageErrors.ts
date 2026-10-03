import { WorldcupStorageUnavailable } from '../application/ports.js';

const DATABASE_FAILURE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE',
  '57P01', '57P02', '57P03', '53300', '53400', '57014', '55P03',
  'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

export function translateStorageError(error: unknown): unknown {
  const code = (error as { code?: string } | null)?.code;
  const unavailable = Boolean(typeof code === 'string' && (DATABASE_FAILURE_CODES.has(code) || code.startsWith('08'))) ||
    (error instanceof Error && /timeout|connection terminated/i.test(error.message));
  return unavailable ? new WorldcupStorageUnavailable() : error;
}

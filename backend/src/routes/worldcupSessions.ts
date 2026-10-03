import type { Request, Response } from 'express';
import { readWorldcupOwner, setWorldcupOwner } from '../auth/worldcupOwner.js';
import { isDbConfigured } from '../db/pool.js';
import { createWorldcupSession } from '../repositories/worldcupSessions.js';
import { validateStartWorldcup, WorldcupSessionError } from '../services/worldcupSession.js';

const DATABASE_FAILURE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE',
  '57P01', '57P02', '57P03', '53300', '53400', '57014', '55P03',
  'SELF_SIGNED_CERT_IN_CHAIN', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

export function createStartSessionHandler(dependencies: {
  create?: typeof createWorldcupSession;
  configured?: () => boolean;
  allowedOrigin?: () => string;
  now?: () => number;
} = {}) {
  const create = dependencies.create ?? createWorldcupSession;
  const configured = dependencies.configured ?? isDbConfigured;
  const allowedOrigin = dependencies.allowedOrigin ?? (() => process.env.CORS_ORIGIN || 'http://localhost:3000');
  const now = dependencies.now ?? Date.now;
  // Bound per-process HTTP traffic as well as the durable per-owner creation limit.
  const requests = new Map<string, { count: number; expiresAt: number }>();
  return async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const input = validateStartWorldcup(req.body, req.headers['idempotency-key']);
      if (req.headers.origin !== allowedOrigin()) {
        throw new WorldcupSessionError(403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 요청 출처입니다.');
      }
      const time = now();
      for (const [ip, value] of requests) if (value.expiresAt <= time) requests.delete(ip);
      const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
      const traffic = requests.get(ip) ?? { count: 0, expiresAt: time + 60000 };
      if (traffic.count >= 60 || (!requests.has(ip) && requests.size >= 10000)) {
        throw new WorldcupSessionError(429, 'WORLD_CUP_RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', Math.max(1, Math.ceil((traffic.expiresAt - time) / 1000)));
      }
      traffic.count++;
      requests.set(ip, traffic);
      const ownerHash = readWorldcupOwner(req);
      if (!ownerHash) {
        setWorldcupOwner(res);
        throw new WorldcupSessionError(428, 'ANONYMOUS_SESSION_REQUIRED', '쿠키를 받은 뒤 같은 요청 키로 다시 시도해 주세요.');
      }
      if (!configured()) {
        throw new WorldcupSessionError(503, 'DATABASE_NOT_CONFIGURED', '데이터베이스 연결 설정이 필요합니다.');
      }
      const result = await create({ ...input, ownerHash });
      res.status(result.replayed ? 200 : 201).json(result.response);
    } catch (error) {
      if (error instanceof WorldcupSessionError) {
        if (error.retryAfter !== undefined) res.setHeader('Retry-After', String(error.retryAfter));
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
      }
      const code = (error as { code?: string } | null)?.code;
      const unavailable = Boolean(code && (DATABASE_FAILURE_CODES.has(code) || code.startsWith('08'))) ||
        (error instanceof Error && /timeout|connection terminated/i.test(error.message));
      // Log only a stable code; database errors can contain credentials or SQL data.
      console.error('WORLDCUP_SESSION_CREATE_FAILED', code && /^[A-Z0-9_]{1,40}$/.test(code) ? code : 'INTERNAL_ERROR');
      res.status(unavailable ? 503 : 500).json({ error: {
        code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
        message: unavailable ? '데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' : '월드컵을 시작하지 못했습니다.',
      } });
    }
  };
}

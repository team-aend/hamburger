import type { Request, Response } from 'express';
import { readWorldcupOwner, setWorldcupOwner } from './ownerCookie.js';
import { validateStartWorldcup, WorldcupHttpError } from './startRequest.js';
import { StartWorldcupError } from '../application/startWorldcup.js';
import { WorldcupStorageUnavailable, type StartWorldcupInput, type StartWorldcupResult } from '../application/ports.js';

export function createStartSessionHandler(dependencies: {
  create: (input: StartWorldcupInput) => Promise<StartWorldcupResult>;
  configured: () => boolean;
  allowedOrigin: () => string;
  secureCookies?: () => boolean;
  now?: () => number;
}) {
  const { create, configured, allowedOrigin } = dependencies;
  const now = dependencies.now ?? Date.now;
  // Bound per-process HTTP traffic as well as the durable per-owner creation limit.
  const requests = new Map<string, { count: number; expiresAt: number }>();
  return async (req: Request, res: Response): Promise<void> => {
    res.setHeader('Cache-Control', 'private, no-store');
    try {
      const input = validateStartWorldcup(req.body, req.headers['idempotency-key']);
      if (req.headers.origin !== allowedOrigin()) {
        throw new WorldcupHttpError(403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 요청 출처입니다.');
      }
      const time = now();
      for (const [ip, value] of requests) if (value.expiresAt <= time) requests.delete(ip);
      const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
      const traffic = requests.get(ip) ?? { count: 0, expiresAt: time + 60000 };
      if (traffic.count >= 60 || (!requests.has(ip) && requests.size >= 10000)) {
        throw new WorldcupHttpError(429, 'WORLD_CUP_RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', Math.max(1, Math.ceil((traffic.expiresAt - time) / 1000)));
      }
      traffic.count++;
      requests.set(ip, traffic);
      const ownerHash = readWorldcupOwner(req);
      if (!ownerHash) {
        setWorldcupOwner(res, dependencies.secureCookies?.() ?? false);
        throw new WorldcupHttpError(428, 'ANONYMOUS_SESSION_REQUIRED', '쿠키를 받은 뒤 같은 요청 키로 다시 시도해 주세요.');
      }
      if (!configured()) {
        throw new WorldcupHttpError(503, 'DATABASE_NOT_CONFIGURED', '데이터베이스 연결 설정이 필요합니다.');
      }
      const result = await create({ ...input, ownerHash, userId: req.user?.id ?? null });
      res.status(result.replayed ? 200 : 201).json(result.response);
    } catch (error) {
      if (error instanceof StartWorldcupError) {
        const status = error.code === 'WORLD_CUP_RATE_LIMITED' ? 429 : 409;
        if (error.retryAfter !== undefined) res.setHeader('Retry-After', String(error.retryAfter));
        res.status(status).json({ error: { code: error.code, message: error.message } });
        return;
      }
      if (error instanceof WorldcupHttpError) {
        if (error.retryAfter !== undefined) res.setHeader('Retry-After', String(error.retryAfter));
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
      }
      const unavailable = error instanceof WorldcupStorageUnavailable;
      console.error('WORLDCUP_SESSION_CREATE_FAILED', unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR');
      res.status(unavailable ? 503 : 500).json({ error: {
        code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
        message: unavailable ? '데이터베이스에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.' : '월드컵을 시작하지 못했습니다.',
      } });
    }
  };
}

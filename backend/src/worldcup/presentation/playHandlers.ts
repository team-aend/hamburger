import type { Request, Response } from 'express';
import { readWorldcupOwner } from './ownerCookie.js';
import { WorldcupHttpError } from './startRequest.js';
import { WorldcupStorageUnavailable } from '../application/ports.js';
import { SessionNotFound, type createGetSession, type createVote } from '../application/playWorldcup.js';
import { WorldcupPlayError } from '../domain/progression.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function uuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new WorldcupHttpError(400, 'INVALID_ID', '세션·경기 ID가 올바르지 않습니다.');
  return value;
}
function owner(req: Request): string {
  const hash = readWorldcupOwner(req);
  if (!hash) throw new WorldcupHttpError(401, 'ANONYMOUS_SESSION_REQUIRED', '월드컵 소유권 쿠키가 필요합니다.');
  return hash;
}
function failure(res: Response, error: unknown): void {
  if (error instanceof WorldcupHttpError) {
    if (error.retryAfter !== undefined) res.setHeader('Retry-After', String(error.retryAfter));
    res.status(error.status).json({ error: { code: error.code, message: error.message } });
  } else if (error instanceof SessionNotFound) {
    res.status(404).json({ error: { code: 'SESSION_NOT_FOUND', message: error.message } });
  } else if (error instanceof WorldcupPlayError) {
    const status = error.code === 'INVALID_SESSION_STATE' ? 500 : error.code === 'MATCH_NOT_FOUND' ? 404 :
      error.code === 'INVALID_WINNER' ? 400 : error.code === 'SESSION_EXPIRED' ? 410 : 409;
    res.status(status).json({ error: { code: error.code, message: error.message } });
  } else {
    const unavailable = error instanceof WorldcupStorageUnavailable;
    console.error('WORLDCUP_PLAY_FAILED', unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR');
    res.status(unavailable ? 503 : 500).json({ error: {
      code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR', message: '월드컵을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    } });
  }
}

export function createPlayHandlers(deps: {
  get: ReturnType<typeof createGetSession>;
  vote: ReturnType<typeof createVote>;
  configured: () => boolean;
  allowedOrigin: () => string;
}) {
  const requests = new Map<string, { count: number; expiresAt: number }>();
  const limitVoteTraffic = (req: Request) => {
    const now = Date.now();
    for (const [ip, value] of requests) if (value.expiresAt <= now) requests.delete(ip);
    const ip = req.ip ?? req.socket?.remoteAddress ?? 'unknown';
    const traffic = requests.get(ip) ?? { count: 0, expiresAt: now + 60000 };
    if (traffic.count >= 60 || (!requests.has(ip) && requests.size >= 10000)) {
      throw new WorldcupHttpError(429, 'WORLD_CUP_RATE_LIMITED', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.', Math.max(1, Math.ceil((traffic.expiresAt - now) / 1000)));
    }
    traffic.count++;
    requests.set(ip, traffic);
  };
  const checkDatabase = () => {
    if (!deps.configured()) throw new WorldcupHttpError(503, 'DATABASE_NOT_CONFIGURED', '데이터베이스 연결 설정이 필요합니다.');
  };
  return {
    get: async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'private, no-store');
      try {
        const id = uuid(req.params.id);
        const hash = owner(req);
        checkDatabase();
        res.status(200).json(await deps.get(id, hash));
      } catch (error) { failure(res, error); }
    },
    vote: async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'private, no-store');
      try {
        const id = uuid(req.params.id);
        const matchId = uuid(req.params.matchId);
        if (req.headers.origin !== deps.allowedOrigin()) throw new WorldcupHttpError(403, 'ORIGIN_NOT_ALLOWED', '허용되지 않은 요청 출처입니다.');
        const hash = owner(req);
        const body = req.body;
        if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length !== 1 ||
            typeof body.winnerProductId !== 'string' || !/^[1-9]\d{0,18}$/.test(body.winnerProductId) ||
            BigInt(body.winnerProductId) > 9223372036854775807n) {
          throw new WorldcupHttpError(400, 'INVALID_WINNER', 'winnerProductId에 양의 정수 문자열을 전달해 주세요.');
        }
        limitVoteTraffic(req);
        checkDatabase();
        res.status(200).json(await deps.vote(id, hash, matchId, body.winnerProductId));
      } catch (error) { failure(res, error); }
    },
  };
}

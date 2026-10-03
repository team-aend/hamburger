import { Router } from 'express';
import type pg from 'pg';
import { getDbPool, isDbConfigured } from '../db/pool.js';
import { createGetWorldcupOptions } from './application/getOptions.js';
import { createStartWorldcup } from './application/startWorldcup.js';
import type { StartWorldcupInput } from './application/ports.js';
import { countEligibleProducts } from './infrastructure/pgProducts.js';
import { PgWorldcupUnitOfWork } from './infrastructure/pgUnitOfWork.js';
import { hashStartBody, randomInt, randomUUID, sessionLifetimeSeconds } from './infrastructure/runtime.js';
import { createOptionsHandler } from './presentation/optionsHandler.js';
import { createStartSessionHandler } from './presentation/startSessionHandler.js';
import { createGetSession, createVote } from './application/playWorldcup.js';
import { createPlayHandlers } from './presentation/playHandlers.js';

// Resolve the database lazily at request time, never during module loading.
export function createWorldcupSession(input: StartWorldcupInput, pool: Pick<pg.Pool, 'connect'> = getDbPool()) {
  return createStartWorldcup(new PgWorldcupUnitOfWork(pool), {
    lifetimeSeconds: sessionLifetimeSeconds,
    hashBody: hashStartBody,
    random: randomInt,
    uuid: randomUUID,
  })(input);
}

export function createWorldcupRouter() {
  const router = Router();
  router.get('/options', createOptionsHandler(createGetWorldcupOptions(countEligibleProducts), isDbConfigured));
  /**
   * POST /sessions: { roundSize: 8 | 16 }, Origin, Idempotency-Key(UUID).
   * Without an owner cookie: 428 + Set-Cookie; retry once with the same key.
   * Creation returns 201; an identical retry by the same owner returns 200.
   */
  router.post('/sessions', createStartSessionHandler({
    create: (input) => createWorldcupSession(input),
    configured: isDbConfigured,
    allowedOrigin: () => process.env.CORS_ORIGIN || 'http://localhost:3000',
    secureCookies: () => process.env.NODE_ENV === 'production',
  }));
  const play = createPlayHandlers({
    get: (id, ownerHash) => createGetSession(new PgWorldcupUnitOfWork(getDbPool()))(id, ownerHash),
    vote: (id, ownerHash, matchId, winnerId) => createVote(new PgWorldcupUnitOfWork(getDbPool()), randomUUID)(id, ownerHash, matchId, winnerId),
    configured: isDbConfigured,
    allowedOrigin: () => process.env.CORS_ORIGIN || 'http://localhost:3000',
  });
  router.get('/sessions/:id', play.get);
  router.post('/sessions/:id/matches/:matchId/vote', play.vote);
  return router;
}

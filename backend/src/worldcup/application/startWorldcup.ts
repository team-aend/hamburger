import { createInitialSession } from '../domain/session.js';
import type { StartWorldcupInput, StartWorldcupResult, WorldcupRuntime, WorldcupUnitOfWork } from './ports.js';

export class StartWorldcupError extends Error {
  constructor(
    public code: 'IDEMPOTENCY_KEY_REUSED' | 'IDEMPOTENCY_KEY_EXPIRED' | 'WORLD_CUP_RATE_LIMITED',
    message: string,
    public retryAfter?: number,
  ) { super(message); }
}

export function createStartWorldcup(unitOfWork: WorldcupUnitOfWork, runtime: WorldcupRuntime) {
  return async (input: StartWorldcupInput): Promise<StartWorldcupResult> => {
    const ttl = runtime.lifetimeSeconds();
    const bodyHash = runtime.hashBody(input.roundSize);
    return unitOfWork.transaction(async (tx) => {
      if (!await tx.reserveCreation(input, bodyHash, Math.max(ttl, 86400))) {
        const record = await tx.findCreation(input.requestKey);
        if (!record) throw new Error('Missing creation request');
        if (record.ownerHash !== input.ownerHash || record.bodyHash !== bodyHash) {
          throw new StartWorldcupError('IDEMPOTENCY_KEY_REUSED', '이미 다른 요청에 사용된 요청 키입니다.');
        }
        if (record.expired) {
          throw new StartWorldcupError('IDEMPOTENCY_KEY_EXPIRED', '재시도 기한이 지난 요청 키입니다.');
        }
        if (!record.state) throw new Error('Incomplete creation request');
        return { replayed: true, response: record.state };
      }
      await tx.lockOwner(input.ownerHash);
      const rate = await tx.recentCreationCount(input.ownerHash, 60);
      if (rate.count >= 5) {
        throw new StartWorldcupError('WORLD_CUP_RATE_LIMITED', '잠시 후 새 월드컵을 시작해 주세요.', rate.retryAfter);
      }
      const products = await tx.listProducts();
      const expiresAt = await tx.expiration(ttl);
      const session = createInitialSession(products, input.roundSize, expiresAt, runtime.random, runtime.uuid);
      await tx.saveSession(input.ownerHash, session);
      await tx.finishCreation(input.requestKey, session.state);
      return { replayed: false, response: session.state };
    });
  };
}

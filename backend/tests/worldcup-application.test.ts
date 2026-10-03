import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStartWorldcup } from '../src/worldcup/application/startWorldcup.js';
import type { CreationRecord, WorldcupRuntime, WorldcupTransaction, WorldcupUnitOfWork } from '../src/worldcup/application/ports.js';
import { createInitialSession } from '../src/worldcup/domain/session.js';

const products = Array.from({ length: 8 }, (_, i) => ({
  productId: String(i + 1), name: `Burger ${i}`, brandName: 'Brand', description: null, imageUrl: null,
}));
const runtime: WorldcupRuntime = {
  lifetimeSeconds: () => 86400,
  hashBody: (size) => `hash-${size}`,
  random: () => 0,
  uuid: () => 'test-id',
};
const input = { roundSize: 8 as const, requestKey: 'request', ownerHash: 'owner' };
const state = createInitialSession(products, 8, '2026-10-04T00:00:00Z', runtime.random, runtime.uuid).state;

function fixture(options: { replay?: CreationRecord; rate?: number; failSave?: boolean } = {}) {
  const effects: string[] = [];
  const members: (number | null | undefined)[] = [];
  const tx: WorldcupTransaction = {
    reserveCreation: async () => !options.replay,
    findCreation: async () => options.replay,
    lockOwner: async () => { effects.push('lock'); },
    recentCreationCount: async () => ({ count: options.rate ?? 0, retryAfter: 30 }),
    listProducts: async () => { effects.push('products'); return products; },
    expiration: async () => state.expiresAt,
    saveSession: async (_owner, session, userId) => {
      members.push(userId);
      effects.push('save');
      assert.equal(session.entries.length, 8);
      assert.equal(session.matches.length, 4);
      if (options.failSave) throw new Error('save failed');
    },
    finishCreation: async () => { effects.push('finish'); },
  };
  const uow: WorldcupUnitOfWork = {
    async transaction(work) {
      effects.push('begin');
      try {
        const result = await work(tx);
        effects.push('commit');
        return result;
      } catch (error) {
        effects.push('rollback');
        throw error;
      }
    },
  };
  return { start: createStartWorldcup(uow, runtime), effects, members };
}

test('application creates a session without an HTTP server or PostgreSQL', async () => {
  const { start, effects } = fixture();
  assert.equal((await start(input)).response.progress.totalMatches, 7);
  assert.deepEqual(effects, ['begin', 'lock', 'products', 'save', 'finish', 'commit']);
});

test('replays bypass drawing, saving and new-session limits', async () => {
  const { start, effects } = fixture({ replay: { ownerHash: 'owner', bodyHash: 'hash-8', state, expired: false }, rate: 5 });
  assert.deepEqual(await start(input), { replayed: true, response: state });
  assert.deepEqual(effects, ['begin', 'commit']);
});

test('different owner, different body and expired requests are rejected before creating', async () => {
  for (const [change, code] of [
    [{ ownerHash: 'someone-else' }, 'IDEMPOTENCY_KEY_REUSED'],
    [{ bodyHash: 'hash-16' }, 'IDEMPOTENCY_KEY_REUSED'],
    [{ expired: true }, 'IDEMPOTENCY_KEY_EXPIRED'],
  ] as const) {
    const { start, effects } = fixture({ replay: { ownerHash: 'owner', bodyHash: 'hash-8', state, expired: false, ...change } });
    await assert.rejects(start(input), { code });
    assert.deepEqual(effects, ['begin', 'rollback']);
  }
});

test('creation limit prevents drawing and a save failure prevents request finalization', async () => {
  const limited = fixture({ rate: 5 });
  await assert.rejects(limited.start(input), { code: 'WORLD_CUP_RATE_LIMITED', retryAfter: 30 });
  assert.deepEqual(limited.effects, ['begin', 'lock', 'rollback']);
  const failed = fixture({ failSave: true });
  await assert.rejects(failed.start(input), /save failed/);
  assert.deepEqual(failed.effects, ['begin', 'lock', 'products', 'save', 'rollback']);
});

test('member association is saved at creation and cannot be changed by a replay', async () => {
  const member = fixture();
  await member.start({ ...input, userId: 42 });
  assert.deepEqual(member.members, [42]);
  const anonymous = fixture();
  await anonymous.start({ ...input, userId: null });
  assert.deepEqual(anonymous.members, [null]);
  const replay = fixture({ replay: { ownerHash: 'owner', bodyHash: 'hash-8', state, expired: false } });
  await replay.start({ ...input, userId: 99 });
  assert.deepEqual(replay.members, []);
});

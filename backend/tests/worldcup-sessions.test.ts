import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import pg from 'pg';
import { createStartSessionHandler } from '../src/worldcup/presentation/startSessionHandler.js';
import { createWorldcupSession } from '../src/worldcup/composition.js';
import { hashStartBody } from '../src/worldcup/infrastructure/runtime.js';
import { createInitialSession } from '../src/worldcup/domain/session.js';
import { validateStartWorldcup } from '../src/worldcup/presentation/startRequest.js';
import { StartWorldcupError } from '../src/worldcup/application/startWorldcup.js';
import { WorldcupStorageUnavailable } from '../src/worldcup/application/ports.js';
import { createGetSession, createVote } from '../src/worldcup/application/playWorldcup.js';
import { PgWorldcupRecords } from '../src/worldcup/infrastructure/pgRecords.js';
import { PgWorldcupUnitOfWork } from '../src/worldcup/infrastructure/pgUnitOfWork.js';

const products = Array.from({ length: 18 }, (_, i) => ({
  productId: String(9007199254740993n + BigInt(i)),
  name: `Burger ${i}`, brandName: 'Brand', description: null, imageUrl: null,
}));
const owner = () => randomBytes(32).toString('hex');
const cookie = () => `bp_worldcup_owner=${randomBytes(32).toString('base64url')}`;
const origin = 'http://localhost:3000';

test('start accepts only numeric 8/16 and a UUID key', () => {
  for (const body of [null, [], '8', { roundSize: 8, products: [] }]) {
    assert.throws(() => validateStartWorldcup(body, randomUUID()), { code: 'INVALID_REQUEST_BODY' });
  }
  for (const value of [undefined, '8', 4, 32]) {
    assert.throws(() => validateStartWorldcup({ roundSize: value }, randomUUID()), { code: 'INVALID_ROUND_SIZE' });
  }
  for (const key of [undefined, [], 'invalid']) {
    assert.throws(() => validateStartWorldcup({ roundSize: 8 }, key), { code: 'INVALID_IDEMPOTENCY_KEY' });
  }
  const key = randomUUID();
  assert.deepEqual(validateStartWorldcup({ roundSize: 8 }, key.toUpperCase()), { roundSize: 8, requestKey: key });
  assert.notEqual(hashStartBody(8), hashStartBody(16));
});

for (const size of [8, 16] as const) {
  test(`${size}-entry draw preserves BIGINT strings and produces only the first round`, () => {
    const result = createInitialSession(products, size, '2026-10-04T00:00:00.000Z', () => 0, randomUUID);
    assert.equal(result.entries.length, size);
    assert.equal(new Set(result.entries.map((p) => p.productId)).size, size);
    assert.equal(result.matches.length, size / 2);
    assert.equal(result.state.progress.totalMatches, size - 1);
    assert.equal(result.state.progress.completedMatches, 0);
    assert.equal(result.state.currentMatch.left.productId, '9007199254740994');
    assert.equal(result.state.currentMatch.left.imageUrl, null);
    assert.deepEqual(products[0].productId, '9007199254740993');
    for (const [i, match] of result.matches.entries()) {
      assert.equal(match.left, result.entries[i * 2]);
      assert.equal(match.right, result.entries[i * 2 + 1]);
    }
  });
}

test('HTTP bootstrap, origin, validation, errors, replay and traffic limits', async () => {
  let calls = 0;
  let configured = true;
  let replayed = false;
  let failure: Error | undefined;
  let time = 0;
  const app = express();
  app.use(express.json());
  app.post('/api/worldcup/sessions', createStartSessionHandler({
    configured: () => configured,
    allowedOrigin: () => origin,
    now: () => time,
    create: async (input) => {
      calls++;
      assert.match(input.ownerHash, /^[a-f0-9]{64}$/);
      if (failure) throw failure;
      return { replayed, response: createInitialSession(products, input.roundSize, '2026-10-04T00:00:00Z', randomInt, randomUUID).state };
    },
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/worldcup/sessions`;
  const requestKey = randomUUID();
  const request = (headers: Record<string, string> = {}, body: unknown = { roundSize: 8 }) => fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, 'Idempotency-Key': requestKey, ...headers },
    body: JSON.stringify(body),
  });
  try {
    const bootstrap = await request();
    assert.equal(bootstrap.status, 428);
    assert.equal(calls, 0);
    assert.match(bootstrap.headers.get('set-cookie')!, /HttpOnly/);
    assert.match(bootstrap.headers.get('set-cookie')!, /SameSite=Lax/);
    const receivedCookie = bootstrap.headers.get('set-cookie')!.split(';')[0];
    assert.equal((await request({ Cookie: receivedCookie })).status, 201);
    assert.equal(calls, 1);
    replayed = true;
    const replay = await request({ Cookie: receivedCookie });
    assert.equal(replay.status, 200);
    assert.equal(replay.headers.get('cache-control'), 'private, no-store');
    assert.equal((await request({ Origin: 'https://evil.example' })).status, 403);
    assert.equal((await request({ Origin: '' })).status, 403);
    assert.equal((await request({}, { roundSize: '8' })).status, 400);
    assert.equal((await request({ Cookie: 'bp_worldcup_owner=malformed' })).status, 428);
    configured = false;
    const noDb = await request({ Cookie: receivedCookie });
    assert.equal(noDb.status, 503);
    assert.equal((await noDb.json()).error.code, 'DATABASE_NOT_CONFIGURED');
    configured = true;
    failure = new StartWorldcupError('WORLD_CUP_RATE_LIMITED', 'wait', 30);
    const limited = await request({ Cookie: receivedCookie });
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get('retry-after'), '30');
    failure = new WorldcupStorageUnavailable();
    const dbFailure = await request({ Cookie: receivedCookie });
    assert.equal(dbFailure.status, 503);
    assert.ok(!(await dbFailure.text()).includes('private'));
    failure = Object.assign(new Error('private SQL details'), { code: '23503' });
    assert.equal((await request({ Cookie: receivedCookie })).status, 500);
    failure = undefined;
    let trafficStatus = 0;
    for (let i = 0; i < 61; i++) trafficStatus = (await request()).status;
    assert.equal(trafficStatus, 429);
    time += 60001;
    assert.equal((await request()).status, 428);
  } finally {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('PostgreSQL creation, constraints, idempotency, concurrency and rollback', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  // Isolated schema shared across connections; never writes to public tables.
  const schema = `worldcup_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL, options: `-c search_path=${schema}`, max: 8 });
  try {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await pool.query(`
      CREATE TABLE users (id bigint PRIMARY KEY);
      INSERT INTO users VALUES (1),(2);
      CREATE TABLE categories (id bigint PRIMARY KEY, slug text);
      CREATE TABLE brands (id bigint PRIMARY KEY, name text, is_active boolean);
      CREATE TABLE products (id bigint PRIMARY KEY, category_id bigint, brand_id bigint, name text, description text, image_url text, status text);
      INSERT INTO categories VALUES (1,'burger'),(2,'side');
      INSERT INTO brands VALUES (1,'Brand',true),(2,'Inactive',false);
      INSERT INTO products SELECT 9007199254740993 + i,1,1,'Burger ' || i,NULL,NULL,'ACTIVE' FROM generate_series(0,17) i;
      INSERT INTO products VALUES (1,1,2,'Inactive brand',NULL,NULL,'ACTIVE'),(2,2,1,'Side',NULL,NULL,'ACTIVE'),(3,1,1,'Discontinued',NULL,NULL,'DISCONTINUED');
    `);
    const migration = readFileSync(path.resolve(__dirname, '../src/db/migrations/004_worldcup_sessions.sql'), 'utf8');
    await pool.query(migration);
    await pool.query(migration);
    const memberMigration = readFileSync(path.resolve(__dirname, '../src/db/migrations/005_worldcup_session_users.sql'), 'utf8');
    await pool.query(memberMigration);
    await pool.query(memberMigration);
    const counts = async () => (await pool.query(`SELECT
      (SELECT count(*)::int FROM worldcup_sessions) AS sessions,
      (SELECT count(*)::int FROM worldcup_entries) AS entries,
      (SELECT count(*)::int FROM worldcup_session_matches) AS matches,
      (SELECT count(*)::int FROM worldcup_creation_requests) AS requests`)).rows[0];
    const input = { roundSize: 8 as const, requestKey: randomUUID(), ownerHash: owner(), userId: 1 };
    const started = await createWorldcupSession(input, pool);
    assert.equal(started.replayed, false);
    assert.equal((await pool.query('SELECT user_id FROM worldcup_sessions WHERE id=$1', [started.response.sessionId])).rows[0].user_id, '1');
    await createWorldcupSession({ ...input, userId: 2 }, pool);
    assert.equal((await pool.query('SELECT user_id FROM worldcup_sessions WHERE id=$1', [started.response.sessionId])).rows[0].user_id, '1');
    assert.deepEqual(await counts(), { sessions: 1, entries: 8, matches: 4, requests: 1 });
    assert.deepEqual(await createWorldcupSession(input, pool), { replayed: true, response: started.response });
    for (const change of [{ roundSize: 16 as const }, { ownerHash: owner() }]) {
      await assert.rejects(createWorldcupSession({ ...input, ...change }, pool), { code: 'IDEMPOTENCY_KEY_REUSED' });
    }
    const larger = await createWorldcupSession({ roundSize: 16, requestKey: randomUUID(), ownerHash: owner() }, pool);
    assert.equal(larger.response.progress.totalMatches, 15);
    assert.deepEqual(await counts(), { sessions: 2, entries: 24, matches: 12, requests: 2 });
    const participants = await pool.query('SELECT product_id FROM worldcup_entries');
    assert.ok(participants.rows.every((r) => typeof r.product_id === 'string' && BigInt(r.product_id) > BigInt(Number.MAX_SAFE_INTEGER)));
    const concurrent = { roundSize: 8 as const, requestKey: randomUUID(), ownerHash: owner() };
    const results = await Promise.all(Array.from({ length: 6 }, () => createWorldcupSession(concurrent, pool)));
    assert.equal(results.filter((r) => !r.replayed).length, 1);
    assert.ok(results.every((r) => r.response.sessionId === results[0].response.sessionId));
    assert.deepEqual(await counts(), { sessions: 3, entries: 32, matches: 16, requests: 3 });
    // Fail after session and entries have been inserted, then reuse the rolled-back key.
    await pool.query(`CREATE FUNCTION fail_match() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$;
      CREATE TRIGGER fail_match BEFORE INSERT ON worldcup_session_matches FOR EACH ROW EXECUTE FUNCTION fail_match()`);
    const failing = { roundSize: 8 as const, requestKey: randomUUID(), ownerHash: owner() };
    await assert.rejects(createWorldcupSession(failing, pool));
    assert.deepEqual(await counts(), { sessions: 3, entries: 32, matches: 16, requests: 3 });
    await pool.query('DROP TRIGGER fail_match ON worldcup_session_matches');
    await createWorldcupSession(failing, pool);
    // Per-owner limits are serialized for different request keys; replays still work.
    const rateOwner = owner();
    const attempts = await Promise.allSettled(Array.from({ length: 6 }, () => createWorldcupSession({
      roundSize: 8, requestKey: randomUUID(), ownerHash: rateOwner,
    }, pool)));
    assert.equal(attempts.filter((r) => r.status === 'fulfilled').length, 5);
    const rejected = attempts.find((r) => r.status === 'rejected') as PromiseRejectedResult;
    assert.equal(rejected.reason.code, 'WORLD_CUP_RATE_LIMITED');
    const rateKey = (await pool.query('SELECT request_key FROM worldcup_creation_requests WHERE owner_token_hash=$1 LIMIT 1', [rateOwner])).rows[0].request_key;
    assert.equal((await createWorldcupSession({ roundSize: 8, requestKey: rateKey, ownerHash: rateOwner }, pool)).replayed, true);
    await pool.query("UPDATE worldcup_creation_requests SET created_at=NOW()-INTERVAL '2 days', retry_expires_at=NOW()-INTERVAL '1 day' WHERE request_key=$1", [input.requestKey]);
    await assert.rejects(createWorldcupSession(input, pool), { code: 'IDEMPOTENCY_KEY_EXPIRED' });
    // Invalid winners and non-entry products cannot be stored.
    await assert.rejects(pool.query('UPDATE worldcup_session_matches SET winner_product_id=1, decided_at=NOW() WHERE id=$1', [started.response.currentMatch.id]));
    await assert.rejects(pool.query('DELETE FROM products WHERE id=$1', [started.response.currentMatch.left.productId]));
    await assert.rejects(pool.query("UPDATE worldcup_sessions SET status='COMPLETED', completed_at=NOW(), winner_product_id=1 WHERE id=$1", [started.response.sessionId]));

    const uow = new PgWorldcupUnitOfWork(pool);
    const get = createGetSession(uow);
    const vote = createVote(uow, randomUUID);
    await assert.rejects(get(input.requestKey, input.ownerHash));
    await assert.rejects(get(started.response.sessionId, owner()), { name: 'Error', message: '월드컵을 찾을 수 없습니다.' });
    // A failed next-round INSERT must roll back the last decision in the current round.
    let view = await get(started.response.sessionId, input.ownerHash);
    for (let i = 0; i < 3; i++) view = await vote(view.sessionId, input.ownerHash, view.currentMatch!.id, view.currentMatch!.left.productId);
    const lastEight = view.currentMatch!;
    await pool.query(`CREATE TRIGGER fail_match BEFORE INSERT ON worldcup_session_matches FOR EACH ROW EXECUTE FUNCTION fail_match()`);
    await assert.rejects(vote(view.sessionId, input.ownerHash, lastEight.id, lastEight.left.productId));
    assert.equal((await get(view.sessionId, input.ownerHash)).progress.completedMatches, 3);
    await pool.query('DROP TRIGGER fail_match ON worldcup_session_matches');
    const duplicateVotes = await Promise.all(Array.from({ length: 4 }, () => vote(view.sessionId, input.ownerHash, lastEight.id, lastEight.left.productId)));
    assert.equal(duplicateVotes.filter((result) => !result.replayed).length, 1);
    assert.ok(duplicateVotes.every((result) => result.progress.currentRoundSize === 4));
    await assert.rejects(vote(view.sessionId, input.ownerHash, lastEight.id, lastEight.right.productId), { code: 'MATCH_ALREADY_DECIDED' });
    // Complete 8 and 16 entries using server state; inspect persisted winners and match count.
    const largerOwner = (await pool.query('SELECT owner_token_hash FROM worldcup_sessions WHERE id=$1', [larger.response.sessionId])).rows[0].owner_token_hash;
    for (const [id, hash, size] of [[started.response.sessionId, input.ownerHash, 8], [larger.response.sessionId, largerOwner, 16]] as const) {
      let current = await get(id, hash);
      while (current.status === 'IN_PROGRESS') {
        const match = current.currentMatch!;
        current = await vote(id, hash, match.id, match.left.productId);
      }
      assert.equal(current.status, 'COMPLETED');
      assert.equal(current.progress.completedMatches, size - 1);
      assert.equal(current.currentMatch, null);
      assert.ok(current.winner);
      const stored = (await pool.query('SELECT status, winner_product_id, completed_at FROM worldcup_sessions WHERE id=$1', [id])).rows[0];
      assert.equal(stored.status, 'COMPLETED');
      assert.equal(stored.winner_product_id, current.winner!.productId);
      assert.ok(stored.completed_at);
      assert.equal((await pool.query('SELECT count(*)::int AS count FROM worldcup_session_matches WHERE session_id=$1', [id])).rows[0].count, size - 1);
      const expected = { ...current } as typeof current & { replayed?: boolean };
      delete expected.replayed;
      assert.deepEqual(await get(id, hash), expected);
    }
    const records = new PgWorldcupRecords(pool);
    assert.equal((await records.rankings()).totalResults, 2);
    assert.equal((await records.history(1)).total, 1);
    assert.equal((await records.history(2)).total, 0);
    await pool.query('DELETE FROM users WHERE id=1');
    assert.equal((await records.history(1)).total, 0);
    assert.equal((await records.rankings()).totalResults, 2);
    // GET reports expiry without writing; votes are rejected on the same expired session.
    await pool.query("UPDATE worldcup_sessions SET created_at=NOW()-INTERVAL '2 days', expires_at=NOW()-INTERVAL '1 day' WHERE id=$1", [results[0].response.sessionId]);
    const expired = await get(results[0].response.sessionId, concurrent.ownerHash);
    assert.equal(expired.status, 'EXPIRED');
    assert.equal(expired.currentMatch, null);
    assert.equal((await pool.query('SELECT status FROM worldcup_sessions WHERE id=$1', [expired.sessionId])).rows[0].status, 'IN_PROGRESS');
    await assert.rejects(vote(expired.sessionId, concurrent.ownerHash, results[0].response.currentMatch.id, results[0].response.currentMatch.left.productId), { code: 'SESSION_EXPIRED' });
  } finally {
    await pool.end();
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  }
});

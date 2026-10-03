import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import pg from 'pg';
import { parseRankingsQuery, createRankingsHandler } from '../src/worldcup/presentation/rankingsHandler.js';
import { PgRankings } from '../src/worldcup/infrastructure/pgRankings.js';
import { WorldcupStorageUnavailable } from '../src/worldcup/application/ports.js';

const defaults = parseRankingsQuery({});
test('ranking query defaults, trimming and strict validation', () => {
  assert.deepEqual(defaults, { sort: 'championships', roundSize: null, q: '', page: 1, pageSize: 20 });
  assert.equal(parseRankingsQuery({ q: ' 버거 ', roundSize: '16' }).q, '버거');
  for (const query of [{ sort: 'name' }, { roundSize: '4' }, { page: '0' }, { page: '1.5' },
    { pageSize: '101' }, { q: 'a'.repeat(101) }, { sort: ['winRate'] }, { page: '9007199254740991' }]) {
    assert.throws(() => parseRankingsQuery(query));
  }
});

test('public HTTP contract validates before querying and distinguishes storage failures', async () => {
  const app = express();
  let calls = 0;
  app.get('/rankings', createRankingsHandler(async (input) => {
    calls++;
    if (input.q === 'offline') throw new WorldcupStorageUnavailable();
    if (input.q === 'unexpected') throw new Error('secret');
    return { ...input, totalCount: 0, completedSessionCount: 0, leaders: [], items: [] };
  }, () => true));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/rankings`;
    const invalid = await fetch(`${url}?page=0`);
    assert.equal(invalid.status, 400);
    assert.equal(calls, 0);
    const result = await fetch(url);
    assert.equal(result.status, 200);
    assert.equal(result.headers.get('cache-control'), 'no-store');
    assert.deepEqual((await result.json()).items, []);
    for (const [q, status, code] of [['offline', 503, 'DATABASE_UNAVAILABLE'], ['unexpected', 500, 'INTERNAL_ERROR']] as const) {
      const response = await fetch(`${url}?q=${q}`);
      assert.equal(response.status, status);
      assert.equal((await response.json()).error.code, code);
    }
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

test('SQL rankings preserve scope, ties, literal search, pagination and empty records', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TEMP TABLE brands (id bigint, name text, is_active boolean);
      CREATE TEMP TABLE categories (id bigint, slug text);
      CREATE TEMP TABLE products (id bigint, name text, brand_id bigint, category_id bigint, image_url text, status text);
      CREATE TEMP TABLE worldcup_sessions (id int, round_size smallint, status text, winner_product_id bigint);
      CREATE TEMP TABLE worldcup_entries (session_id int, product_id bigint);
      CREATE TEMP TABLE worldcup_session_matches (session_id int, left_product_id bigint, right_product_id bigint, winner_product_id bigint);
      INSERT INTO brands VALUES (1,'브랜드',true);
      INSERT INTO categories VALUES (1,'burger');
      INSERT INTO products VALUES (9007199254740993,'100%_버거',1,1,NULL,'DISCONTINUED'),
        (2,'버거 B',1,1,NULL,'ACTIVE'),(3,'버거 C',1,1,NULL,'ACTIVE'),(4,'미참가',1,1,NULL,'ACTIVE');
      INSERT INTO worldcup_sessions VALUES (1,8,'COMPLETED',9007199254740993),(2,16,'COMPLETED',2),
        (3,8,'IN_PROGRESS',2),(4,8,'ABANDONED',2),(5,8,'EXPIRED',2);
      INSERT INTO worldcup_entries SELECT id, p FROM worldcup_sessions CROSS JOIN (VALUES (9007199254740993::bigint),(2),(3)) v(p);
      INSERT INTO worldcup_session_matches SELECT id,9007199254740993,2,9007199254740993 FROM worldcup_sessions;
      INSERT INTO worldcup_session_matches VALUES (1,9007199254740993,3,9007199254740993),(2,2,3,2);
    `);
    const repo = new PgRankings(client);
    const all = await repo.read(defaults);
    assert.equal(all.completedSessionCount, 2);
    assert.equal(all.totalCount, 2);
    assert.deepEqual(all.items.map((item) => item.rank), [1, 1]);
    assert.ok(all.items.every((item) => item.championships >= 1));
    assert.ok(all.leaders.every((item) => item.championships >= 1));
    assert.equal((await repo.read({ ...defaults, q: '버거 C' })).totalCount, 0);
    const winner = all.items.find((item) => item.productId === '9007199254740993')!;
    assert.equal(winner.championships, 1);
    assert.equal(winner.appearances, 2);
    assert.equal(winner.matches, 3);
    assert.equal(winner.status, 'DISCONTINUED');
    const searched = await repo.read({ ...defaults, q: '%_', pageSize: 1 });
    assert.equal(searched.totalCount, 1);
    assert.equal(searched.items[0].productId, winner.productId);
    assert.deepEqual(searched.leaders, all.leaders);
    assert.equal((await repo.read({ ...defaults, q: 'missing' })).totalCount, 0);
    assert.deepEqual((await repo.read({ ...defaults, page: 100 })).items, []);
    const eight = await repo.read({ ...defaults, roundSize: 8 });
    assert.equal(eight.completedSessionCount, 1);
    assert.equal(eight.totalCount, 1);
    assert.equal(eight.items[0].productId, winner.productId);
    assert.equal(eight.items[0].appearances, 1);
    assert.equal(eight.items[0].matches, 2);
    const rate = await repo.read({ ...defaults, sort: 'winRate' });
    assert.equal(rate.items[0].productId, winner.productId);
    assert.equal(rate.items[0].winRate, 100);
    // Distinct exact rates can display the same rounded percentage without tying.
    await client.query(`
      DELETE FROM worldcup_session_matches;
      INSERT INTO worldcup_session_matches
        SELECT 1,9007199254740993,4, CASE WHEN n <= 667 THEN 9007199254740993 ELSE 4 END FROM generate_series(1,1000) n;
      INSERT INTO worldcup_session_matches
        SELECT 1,2,4, CASE WHEN n <= 1333 THEN 2 ELSE 4 END FROM generate_series(1,2000) n;
    `);
    const precise = await repo.read({ ...defaults, sort: 'winRate' });
    const a = precise.items.find((item) => item.productId === winner.productId)!;
    const b = precise.items.find((item) => item.productId === '2')!;
    assert.equal(a.winRate, b.winRate);
    assert.ok(a.rank! < b.rank!);
    // Products tied at third with at least one championship remain in leaders.
    await client.query(`
      INSERT INTO products VALUES (5,'버거 D',1,1,NULL,'ACTIVE');
      INSERT INTO worldcup_entries VALUES (1,4),(1,5);
      INSERT INTO worldcup_session_matches VALUES (1,3,5,3);
      INSERT INTO worldcup_sessions VALUES (6,8,'COMPLETED',9007199254740993),(7,8,'COMPLETED',2),
        (8,8,'COMPLETED',3),(9,8,'COMPLETED',4),(10,8,'COMPLETED',5);
    `);
    const shared = await repo.read(defaults);
    assert.deepEqual(shared.leaders.map((item) => item.rank), [1,1,3,3,3]);
    await client.query('DELETE FROM worldcup_sessions');
    const empty = await repo.read(defaults);
    assert.equal(empty.completedSessionCount, 0);
    assert.equal(empty.totalCount, 0);
    assert.deepEqual(empty.leaders, []);
    assert.deepEqual(empty.items, []);
  } finally { client.release(true); await pool.end(); }
});

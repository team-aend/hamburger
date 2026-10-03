import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import pg from 'pg';
import { createWorldcupRouter } from '../src/worldcup/composition.js';
import { PgWorldcupRecords } from '../src/worldcup/infrastructure/pgRecords.js';
import { createRecordsHandlers } from '../src/worldcup/presentation/recordsHandlers.js';

test('retired sample result submissions are no longer accepted', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/worldcup', createWorldcupRouter());
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/api/worldcup/results`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ winnerBurgerId: 'classic-cheese', roundSize: 8 }),
    });
    assert.equal(response.status, 404);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('record read failures report an error instead of sample or empty results', async () => {
  const app = express();
  const handlers = createRecordsHandlers({
    rankings: async () => { throw new Error('database failed'); },
    history: async () => { throw new Error('database failed'); },
  });
  app.get('/rankings', handlers.rankings);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    const address = server.address() as { port: number };
    const response = await fetch(`http://127.0.0.1:${address.port}/rankings`);
    assert.equal(response.status, 503);
    assert.deepEqual(Object.keys(await response.json()), ['message']);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('records aggregate only completed real sessions and preserve member boundaries and BIGINT IDs', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TEMP TABLE brands (id bigint, name text, is_active boolean);
      CREATE TEMP TABLE categories (id bigint, slug text);
      CREATE TEMP TABLE products (id bigint, name text, brand_id bigint, category_id bigint, description text, image_url text, status text);
      CREATE TEMP TABLE worldcup_sessions (id uuid, user_id bigint, round_size smallint, status text, winner_product_id bigint, completed_at timestamptz);
      CREATE TEMP TABLE worldcup_entries (session_id uuid, product_id bigint, name text, brand_name text, description text, image_url text);
      CREATE TEMP TABLE worldcup_session_matches (session_id uuid, left_product_id bigint, right_product_id bigint, winner_product_id bigint);
      INSERT INTO brands VALUES (1,'실제 브랜드',true);
      INSERT INTO categories VALUES (1,'burger');
      INSERT INTO products VALUES
        (9007199254740993,'실제 우승 상품',1,1,NULL,NULL,'DISCONTINUED'),
        (9007199254740994,'현재 상품',1,1,NULL,NULL,'ACTIVE');
      INSERT INTO worldcup_sessions VALUES
        ('00000000-0000-4000-8000-000000000001',1,8,'COMPLETED',9007199254740993,'2026-10-01T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000002',2,8,'COMPLETED',9007199254740993,'2026-10-02T00:00:00Z'),
        ('00000000-0000-4000-8000-000000000003',1,8,'IN_PROGRESS',NULL,NULL),
        ('00000000-0000-4000-8000-000000000004',1,8,'EXPIRED',NULL,NULL),
        ('00000000-0000-4000-8000-000000000005',1,8,'ABANDONED',NULL,NULL);
      INSERT INTO worldcup_entries
        SELECT id,9007199254740993,'시작 당시 상품 이름','시작 당시 브랜드',NULL,NULL FROM worldcup_sessions;
      INSERT INTO worldcup_session_matches
        SELECT id,9007199254740993,9007199254740994,9007199254740993 FROM worldcup_sessions;
    `);
    const records = new PgWorldcupRecords(client);
    const ranking = await records.rankings();
    assert.equal(ranking.totalResults, 2);
    assert.equal(ranking.stats.length, 2);
    const winner = ranking.stats.find((item) => item.productId === '9007199254740993')!;
    assert.equal(winner.name, '실제 우승 상품');
    assert.equal(winner.championships, 2);
    assert.equal(winner.matches, 2);
    assert.equal(winner.wins, 2);
    const history = await records.history(1);
    assert.equal(history.total, 1);
    assert.equal(history.championships[0].count, 1);
    assert.equal(history.results[0].winner.productId, '9007199254740993');
    assert.equal(history.results[0].winner.name, '시작 당시 상품 이름');
    assert.deepEqual(await records.history(999), { total: 0, championships: [], results: [] });
    await client.query('DELETE FROM worldcup_session_matches; DELETE FROM worldcup_entries; DELETE FROM worldcup_sessions');
    const empty = await records.rankings();
    assert.equal(empty.totalResults, 0);
    assert.equal(empty.stats.length, 1);
    assert.equal(empty.stats[0].championships, 0);
  } finally {
    client.release(true);
    await pool.end();
  }
});

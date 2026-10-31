import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { winnerPath, type DecidedMatch } from '../src/worldcup/domain/share.js';
import { createGetShare } from '../src/worldcup/application/getShare.js';
import { WorldcupStorageUnavailable } from '../src/worldcup/application/ports.js';
import { PgWorldcupShare } from '../src/worldcup/infrastructure/pgShare.js';
import { createShareHandler } from '../src/worldcup/presentation/shareHandler.js';
import { withServer } from './helpers/http.js';

const product = (id: string) => ({ productId: id, name: `버거 ${id}`, brandName: '브랜드', description: null, imageUrl: null });
const match = (roundSize: number, left: string, right: string, winner: string): DecidedMatch =>
  ({ roundSize, left: product(left), right: product(right), winnerProductId: winner });
const SESSION = '3f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e';

test('winner path lists defeated opponents from the first round to the final', () => {
  const matches = [
    match(2, '1', '5', '1'), match(8, '1', '2', '1'), match(8, '3', '4', '3'),
    match(8, '5', '6', '5'), match(4, '3', '1', '1'), match(8, '7', '8', '7'),
  ];
  assert.deepEqual(winnerPath(matches, '1').map((s) => [s.roundSize, s.opponent.productId]), [[8, '2'], [4, '3'], [2, '5']]);
  assert.deepEqual(winnerPath([match(4, '2', '3', '2')], '1'), [], '우승 버거가 없는 경기는 무시');
});

test('application shares only completed sessions', async () => {
  const get = createGetShare({
    findCompleted: async (id) => id === SESSION
      ? { sessionId: id, roundSize: 8, completedAt: '2026-10-16T00:00:00Z', winner: product('1'), matches: [match(2, '1', '5', '1')] }
      : null,
  });
  assert.equal(await get('00000000-0000-4000-8000-000000000000'), null);
  const share = (await get(SESSION))!;
  assert.equal(share.winner.productId, '1');
  assert.deepEqual(share.path.map((s) => s.opponent.productId), ['5']);
  assert.ok(!('matches' in share));
});

test('HTTP contract: invalid id, not shared, ok and storage failures', async () => {
  const handler = createShareHandler(async (id) => {
    if (id === SESSION) return { sessionId: id, roundSize: 8, completedAt: '2026-10-16T00:00:00Z', winner: product('1'), path: [] };
    if (id.startsWith('5')) throw new WorldcupStorageUnavailable();
    return null;
  }, () => true);
  await withServer((app) => app.get('/share/:sessionId', handler), async (url) => {
    assert.equal((await fetch(`${url}/share/not-a-uuid`)).status, 400);
    const ok = await fetch(`${url}/share/${SESSION.toUpperCase()}`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.equal((await ok.json()).winner.productId, '1');
    assert.equal((await (await fetch(`${url}/share/00000000-0000-4000-8000-000000000000`)).json()).error.code, 'SHARE_NOT_FOUND');
    assert.equal((await fetch(`${url}/share/5f2b8c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e`)).status, 503);
  });
});

test('SQL share reads entry snapshots and hides unfinished sessions', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TEMP TABLE worldcup_sessions (id uuid, round_size smallint, status text, completed_at timestamptz, winner_product_id bigint);
      CREATE TEMP TABLE worldcup_entries (session_id uuid, product_id bigint, name text, brand_name text, description text, image_url text);
      CREATE TEMP TABLE worldcup_session_matches (session_id uuid, round_size smallint, match_index smallint, left_product_id bigint, right_product_id bigint, winner_product_id bigint);
      INSERT INTO worldcup_sessions VALUES
        ('${SESSION}', 8, 'COMPLETED', '2026-10-16', 9007199254740993),
        ('00000000-0000-4000-8000-000000000000', 8, 'IN_PROGRESS', NULL, NULL);
      INSERT INTO worldcup_entries VALUES ('${SESSION}', 9007199254740993, '당시 이름', '브랜드', NULL, NULL), ('${SESSION}', 2, '버거 2', '브랜드', NULL, NULL);
      INSERT INTO worldcup_session_matches VALUES ('${SESSION}', 2, 0, 2, 9007199254740993, 9007199254740993);
    `);
    const repo = new PgWorldcupShare(client);
    const record = (await repo.findCompleted(SESSION))!;
    assert.equal(record.winner.productId, '9007199254740993');
    assert.equal(record.winner.name, '당시 이름');
    assert.equal(record.matches.length, 1);
    assert.equal(await repo.findCompleted('00000000-0000-4000-8000-000000000000'), null);
  } finally {
    client.release();
    await pool.end();
  }
});

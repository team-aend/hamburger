import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { detectPriceChanges, type LikedPriceSnapshot } from '../src/priceAlerts/domain/priceChange.js';
import { createPriceAlerts } from '../src/priceAlerts/application/priceAlerts.js';
import { PgPriceAlerts } from '../src/priceAlerts/infrastructure/pgPriceAlerts.js';
import { createPriceAlertsHandlers } from '../src/priceAlerts/presentation/priceAlertsHandlers.js';
import { withServer } from './helpers/http.js';

const snap = (productId: string, priceAtLike: number | null, currentPrice: number | null, currentSince: string | null): LikedPriceSnapshot =>
  ({ productId, priceAtLike, currentPrice, currentSince });

test('only burgers whose price changed after the like become alerts, newest first', () => {
  const changes = detectPriceChanges([
    snap('1', 7100, 7400, '2026-10-14T00:00:00Z'), // 인상
    snap('2', 5000, 5000, '2026-01-01T00:00:00Z'), // 그대로
    snap('3', 6000, 5500, '2026-10-10T00:00:00Z'), // 인하
    snap('4', null, 5000, '2026-10-12T00:00:00Z'), // 좋아요 시점 가격 모름
    snap('5', 5000, null, null), // 지금 가격 없음 (판매 종료 등)
  ], '2026-10-12T00:00:00Z');
  assert.deepEqual(changes.map((c) => [c.productId, c.direction, c.isNew]), [['1', 'UP', true], ['3', 'DOWN', false]]);
  assert.equal(changes[0].previousPrice, 7100);
  assert.ok(detectPriceChanges([snap('1', 1, 2, '2020-01-01T00:00:00Z')], null)[0].isNew, '한 번도 확인 안 했으면 모두 새 알림');
});

test('application counts only new alerts and marks them seen through the port', async () => {
  const seen: number[] = [];
  const alerts = createPriceAlerts({
    likedSnapshots: async () => ({
      snapshots: [snap('1', 1, 2, '2026-10-14T00:00:00Z'), snap('2', 1, 2, '2026-10-01T00:00:00Z')],
      seenAt: '2026-10-10T00:00:00Z',
    }),
    markSeen: async (userId) => { seen.push(userId); },
  });
  assert.equal(await alerts.countNew(3), 1);
  assert.equal((await alerts.changes(3)).length, 2);
  await alerts.markSeen(3);
  assert.deepEqual(seen, [3]);
});

test('HTTP contract for marking alerts as seen', async () => {
  let fail = false;
  const handlers = createPriceAlertsHandlers({
    changes: async () => [], countNew: async () => 0,
    markSeen: async () => { if (fail) throw new Error('secret'); },
  });
  await withServer((app) => app.post('/seen', handlers.markSeen), async (url) => {
    assert.equal((await fetch(`${url}/seen`, { method: 'POST' })).status, 204);
    fail = true;
    const res = await fetch(`${url}/seen`, { method: 'POST' });
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error.code, 'INTERNAL_ERROR');
  }, { id: 1 });
});

test('SQL snapshots use the price valid at like time and the current price', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TEMP TABLE users (id bigint, price_alerts_seen_at timestamptz);
      CREATE TEMP TABLE product_likes (user_id bigint, product_id bigint, created_at timestamptz);
      CREATE TEMP TABLE product_variants (id bigint, product_id bigint, variant_type text, is_default boolean, is_active boolean);
      CREATE TEMP TABLE product_prices (id bigint, product_variant_id bigint, price int, channel text, started_at timestamptz, ended_at timestamptz);
      INSERT INTO users VALUES (1, '2026-10-05');
      INSERT INTO product_likes VALUES (1, 9007199254740993, '2026-10-01'), (1, 2, '2026-10-01');
      INSERT INTO product_variants VALUES (10, 9007199254740993, 'SET', true, true), (11, 9007199254740993, 'SINGLE', false, true), (20, 2, 'SINGLE', true, true);
      INSERT INTO product_prices VALUES
        (1, 11, 7100, 'STORE', '2026-01-01', '2026-10-08'), (2, 11, 7400, 'STORE', '2026-10-08', NULL),
        (3, 11, 8100, 'DELIVERY', '2026-01-01', NULL), (4, 10, 9100, 'STORE', '2026-01-01', NULL),
        (5, 20, 5000, 'STORE', '2026-01-01', NULL);
    `);
    const { snapshots, seenAt } = await new PgPriceAlerts(client).likedSnapshots(1);
    assert.equal(seenAt, new Date('2026-10-05').toISOString());
    assert.deepEqual(snapshots.map((s) => [s.productId, s.priceAtLike, s.currentPrice]), [
      ['2', 5000, 5000], ['9007199254740993', 7100, 7400],
    ]);
    assert.deepEqual((await new PgPriceAlerts(client).likedSnapshots(999)).snapshots, []);
  } finally {
    client.release();
    await pool.end();
  }
});

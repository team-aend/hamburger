import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import recommendRouter from '../src/routes/recommend.js';
import { getCachedDataset, invalidateDatasetCache } from '../src/db/datasetCache.js';
import { getDbPool } from '../src/db/pool.js';
import { withServer } from './helpers/http.js';

test('DB image URLs survive dataset caching, recommendation filtering and random responses', {
  skip: !process.env.TEST_DATABASE_URL,
}, async (t) => {
  const testPool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await testPool.connect();
  const previousDatabaseUrl = process.env.DATABASE_URL;
  let applicationPool: pg.Pool | null = null;
  try {
    await client.query('SET search_path TO pg_temp');
    await client.query(`
      CREATE TEMP TABLE brands (id bigint, name text, slug text, logo_url text, homepage_url text, is_active boolean);
      CREATE TEMP TABLE categories (id bigint, name text, slug text);
      CREATE TEMP TABLE ingredients (id bigint, name text, slug text, ingredient_group text);
      CREATE TEMP TABLE tags (id bigint, name text, slug text);
      CREATE TEMP TABLE products (
        id bigint, brand_id bigint, category_id bigint, name text, slug text,
        description text, image_url text, status text, is_limited boolean
      );
      CREATE TEMP TABLE product_variants (id bigint, product_id bigint, name text, variant_type text, is_default boolean, is_active boolean);
      CREATE TEMP TABLE product_prices (id bigint, product_variant_id bigint, price integer, channel text, started_at timestamptz, ended_at timestamptz);
      CREATE TEMP TABLE nutrition (
        id bigint, product_variant_id bigint, serving_size_g numeric, calories_kcal numeric,
        protein_g numeric, sugar_g numeric, saturated_fat_g numeric, sodium_mg numeric
      );
      CREATE TEMP TABLE product_ingredients (product_id bigint, ingredient_id bigint, sort_order integer);
      CREATE TEMP TABLE product_tags (product_id bigint, tag_id bigint);

      INSERT INTO brands VALUES (1, '테스트 브랜드', 'image-test-brand', NULL, NULL, true);
      INSERT INTO categories VALUES (1, '햄버거', 'burger');
      INSERT INTO ingredients VALUES (1, '치킨 패티', 'chicken-patty', 'PATTY');
      INSERT INTO tags VALUES (1, '테스트', 'image-test');
      INSERT INTO products VALUES
        (101, 1, 1, 'RelativeBurger', 'relative-burger', '상대 이미지', '/images/burgers/mcdonalds-big-mac-ai.png', 'ACTIVE', false),
        (102, 1, 1, 'RemoteBurger', 'remote-burger', '서버 이미지', 'https://images.example.com/burgers/remote.png', 'ACTIVE', false),
        (103, 1, 1, 'NoImageBurger', 'no-image-burger', '사진 없음', NULL, 'ACTIVE', false);
      INSERT INTO product_variants
        SELECT id, id, name, 'SINGLE', true, true FROM products;
      INSERT INTO product_prices
        SELECT id, id, 5000, 'STORE', '2026-01-01T00:00:00Z', NULL FROM products;
      INSERT INTO nutrition
        SELECT id, id, 200, 500, 25, 5, 3, 700 FROM products;
      INSERT INTO product_ingredients SELECT id, 1, 1 FROM products;
      INSERT INTO product_tags SELECT id, 1 FROM products;
    `);

    // Redirect the real cache loader's pool queries to this connection's TEMP tables.
    // No application query can reach DATABASE_URL or a public schema during this test.
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    let pendingQuery = Promise.resolve();
    const queryMock = t.mock.method(pg.Pool.prototype, 'query', (sql: string) => {
      // A fixture has one client; serialize its queries while the production pool stays parallel.
      const result = pendingQuery.then(() => client.query(sql));
      pendingQuery = result.then(() => undefined, () => undefined);
      return result;
    });
    applicationPool = getDbPool();
    invalidateDatasetCache();
    const expectedImages = [
      [101, '/images/burgers/mcdonalds-big-mac-ai.png'],
      [102, 'https://images.example.com/burgers/remote.png'],
      [103, null],
    ];
    const loaded = await getCachedDataset({ forceRefresh: true });
    assert.equal(loaded.dataset.source, 'supabase');
    assert.equal(loaded.cacheHit, false);
    assert.deepEqual(loaded.dataset.products.map((p) => [p.id, p.imageUrl]), expectedImages);
    assert.deepEqual(loaded.dataset.baseEnrichedProducts.map((p) => [p.id, p.imageUrl]), expectedImages);
    const queryCount = queryMock.mock.callCount();

    await withServer((app) => app.use('/api/recommend', recommendRouter), async (url) => {
      const list = await fetch(`${url}/api/recommend?includeFilters=true&sortBy=price_asc`);
      assert.equal(list.status, 200);
      const body = await list.json();
      assert.equal(body.totalCount, 3);
      assert.equal(body.cache.hit, true);
      assert.deepEqual(body.items.map((p: { id: number; imageUrl: string | null }) => [p.id, p.imageUrl]), expectedImages);
      assert.equal(body.filters.brands[0].slug, 'image-test-brand');

      for (const [name, id, imageUrl] of [
        ['RelativeBurger', 101, expectedImages[0][1]],
        ['RemoteBurger', 102, expectedImages[1][1]],
        ['NoImageBurger', 103, null],
      ]) {
        const query = new URLSearchParams({ keyword: String(name), brands: 'image-test-brand', includeIngredients: 'chicken-patty' });
        const filtered = await fetch(`${url}/api/recommend?${query}`);
        assert.equal(filtered.status, 200);
        const filteredBody = await filtered.json();
        assert.equal(filteredBody.totalCount, 1);
        assert.equal(filteredBody.items[0].id, id);
        assert.equal(filteredBody.items[0].imageUrl, imageUrl);

        // One matching candidate makes the random endpoint deterministic.
        const random = await fetch(`${url}/api/recommend/random?${query}`);
        assert.equal(random.status, 200);
        const randomBody = await random.json();
        assert.equal(randomBody.totalCandidates, 1);
        assert.equal(randomBody.picked.id, id);
        assert.equal(randomBody.picked.imageUrl, imageUrl);
      }
      const emptyRandom = await fetch(`${url}/api/recommend/random?keyword=missing-product`);
      assert.equal((await emptyRandom.json()).picked, null);
    });
    assert.equal(queryMock.mock.callCount(), queryCount, 'HTTP reads retain image URLs from the warm cache without reloading');
  } finally {
    invalidateDatasetCache();
    if (applicationPool) await applicationPool.end();
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
    client.release(true);
    await testPool.end();
  }
});

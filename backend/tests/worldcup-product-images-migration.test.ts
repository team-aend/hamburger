import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { listEligibleProducts } from '../src/worldcup/infrastructure/pgProducts.js';

const imageMappings = [
  ['mcdonalds', 'big-mac'],
  ['mcdonalds', 'mcspicy-shanghai-burger'],
  ['mcdonalds', 'mcchicken-mozzarella'],
  ['mcdonalds', 'bacon-tomato-deluxe'],
  ['burgerking', 'whopper'],
  ['burgerking', 'quattro-cheese-whopper'],
  ['burgerking', 'long-chicken-burger'],
  ['burgerking', 'shrimp-whopper'],
  ['momstouch', 'deep-cheese-burger'],
  ['momstouch', 'white-garlic-burger'],
  ['momstouch', 'incredible-burger'],
  ['lotteria', 'shrimp-burger'],
  ['lotteria', 'ria-bulgogi-burger'],
  ['kfc', 'zinger-burger'],
  ['kfc', 'kernel-goldmoon-burger'],
  ['frankburger', 'frank-burger'],
  ['frankburger', 'jg-cheese-burger'],
] as const;

// Only TEST_DATABASE_URL is read. All fixtures live in one connection's temporary schema.
test('PostgreSQL worldcup image migration maps all products and preserves existing images and snapshots', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO pg_temp');
    await client.query(`
      CREATE TEMP TABLE categories (id bigint PRIMARY KEY, slug text NOT NULL);
      CREATE TEMP TABLE brands (id bigint PRIMARY KEY, slug text NOT NULL UNIQUE, name text NOT NULL, is_active boolean NOT NULL);
      CREATE TEMP TABLE products (
        id bigint PRIMARY KEY, category_id bigint NOT NULL, brand_id bigint NOT NULL,
        name text NOT NULL, slug text NOT NULL, description text, image_url text,
        status text NOT NULL, updated_at timestamptz NOT NULL,
        UNIQUE (brand_id, slug)
      );
      CREATE TEMP TABLE worldcup_entries (
        session_id uuid NOT NULL, product_id bigint NOT NULL, position smallint NOT NULL,
        name text NOT NULL, brand_name text NOT NULL, description text, image_url text,
        PRIMARY KEY (session_id, product_id), UNIQUE (session_id, position)
      );
      INSERT INTO categories VALUES (1, 'burger');
      INSERT INTO brands VALUES (99, 'another-brand', '다른 브랜드', true);
    `);

    const brandSlugs = [...new Set(imageMappings.map(([brandSlug]) => brandSlug))];
    const brandIds = new Map(brandSlugs.map((slug, index) => [slug, index + 1]));
    for (const [slug, id] of brandIds) {
      await client.query('INSERT INTO brands VALUES ($1, $2, $2, true)', [id, slug]);
    }
    for (const [index, [brandSlug, productSlug]] of imageMappings.entries()) {
      const productId = 100 + index;
      const brandId = brandIds.get(brandSlug);
      await client.query(`
        INSERT INTO products VALUES
          ($1, 1, $2, $3, $3, '원래 상품 설명', NULL, 'ACTIVE', '2000-01-01T00:00:00Z'),
          ($4, 1, 99, $3, $3, '동일 상품 슬러그의 다른 브랜드', NULL, 'ACTIVE', '2000-01-01T00:00:00Z'),
          ($5, 1, $2, $6, $6, '동일 브랜드의 다른 상품', NULL, 'ACTIVE', '2000-01-01T00:00:00Z')
      `, [productId, brandId, productSlug, 1000 + index, 2000 + index, `other-${productSlug}`]);
      await client.query(`
        INSERT INTO worldcup_entries VALUES ($1, $2, $3, $4, $5, '시작 시점의 설명', $6)
      `, [
        index < 16 ? '00000000-0000-0000-0000-000000000001' : '00000000-0000-0000-0000-000000000002',
        productId, index % 16, productSlug, brandSlug,
        index % 2 === 0 ? null : 'https://images.example.com/previous-session.png',
      ]);
    }
    const thighBurgerImageUrl = 'https://example.supabase.co/storage/v1/object/public/burgers/thigh-burger.png';
    await client.query(`
      INSERT INTO products VALUES
        (999, 1, $1, '싸이버거', 'thigh-burger', NULL, $2, 'ACTIVE', '2000-01-01T00:00:00Z')
    `, [brandIds.get('momstouch'), thighBurgerImageUrl]);

    const migration = readFileSync(path.resolve(__dirname, '../src/db/migrations/010_worldcup_product_images.sql'), 'utf8');
    const rows = async () => (await client.query(`
      SELECT id, category_id, brand_id, name, slug, description, image_url, status, updated_at::text
      FROM products ORDER BY id
    `)).rows;
    const snapshots = async () => (await client.query('SELECT * FROM worldcup_entries ORDER BY product_id')).rows;
    const originalSnapshots = await snapshots();
    const productIds = imageMappings.map((_, index) => 100 + index);

    // Alternate NULL and empty values, then swap them so each mapping exercises both cases.
    for (const offset of [0, 1]) {
      await client.query(`
        UPDATE products
        SET image_url = CASE WHEN (id + $1)::integer % 2 = 0 THEN NULL ELSE '' END,
            updated_at = '2000-01-01T00:00:00Z'
        WHERE id = ANY($2::bigint[])
      `, [offset, productIds]);
      const before = await rows();
      assert.equal((await client.query(migration)).rowCount, imageMappings.length);
      const after = await rows();
      const eligible = await listEligibleProducts(client);

      for (const [index, [brandSlug, productSlug]] of imageMappings.entries()) {
        const id = String(100 + index);
        const imageUrl = `/images/burgers/${brandSlug}-${productSlug}-ai.png`;
        const original = before.find((row) => row.id === id);
        const updated = after.find((row) => row.id === id);
        assert.ok(original);
        assert.ok(updated);
        assert.notEqual(updated.updated_at, original.updated_at);
        assert.deepEqual(updated, { ...original, image_url: imageUrl, updated_at: updated.updated_at });
        assert.equal(eligible.find((product) => product.productId === id)?.imageUrl, imageUrl);
      }
      assert.deepEqual(
        after.filter((row) => Number(row.id) >= 999),
        before.filter((row) => Number(row.id) >= 999),
        'same slugs under other brands, other products, and the existing Supabase thigh burger remain unchanged',
      );
      assert.deepEqual(await snapshots(), originalSnapshots, 'existing session entry snapshots are preserved');
      assert.equal((await client.query(migration)).rowCount, 0);
      assert.deepEqual(await rows(), after, 'rerunning preserves all fields, including updated_at');
    }

    for (const existingImageUrl of ['https://images.example.com/uploaded.png', '/uploaded/burger.png', ' ']) {
      await client.query(`
        UPDATE products SET image_url=$1, updated_at='2000-01-01T00:00:00Z'
        WHERE id = ANY($2::bigint[])
      `, [existingImageUrl, productIds]);
      const before = await rows();
      assert.equal((await client.query(migration)).rowCount, 0);
      assert.deepEqual(await rows(), before, 'all existing nonempty URLs and timestamps are preserved');
      const eligible = await listEligibleProducts(client);
      for (const productId of productIds) {
        assert.equal(eligible.find((product) => product.productId === String(productId))?.imageUrl, existingImageUrl);
      }
      assert.equal(eligible.find((product) => product.productId === '999')?.imageUrl, thighBurgerImageUrl);
      assert.deepEqual(await snapshots(), originalSnapshots);
    }
  } finally {
    client.release(true);
    await pool.end();
  }
});

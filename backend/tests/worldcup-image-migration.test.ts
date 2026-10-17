import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import { listEligibleProducts } from '../src/worldcup/infrastructure/pgProducts.js';

const imageUrl = '/images/burgers/momstouch-thigh-burger-ai.png';

// Fixtures only exist in this connection's temporary schema; public tables are inaccessible.
test('PostgreSQL image migration targets only an empty Momstouch thigh burger image and is repeatable', {
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
      INSERT INTO categories VALUES (1, 'burger');
      INSERT INTO brands VALUES (1, 'momstouch', '맘스터치', true), (2, 'another-brand', '다른 브랜드', true);
      INSERT INTO products VALUES
        (9, 1, 1, '싸이버거', 'thigh-burger', '통다리살 버거', NULL, 'ACTIVE', '2000-01-01T00:00:00Z'),
        (10, 1, 1, '다른 싸이버거', 'another-thigh-burger', NULL, NULL, 'ACTIVE', '2000-01-01T00:00:00Z'),
        (11, 1, 2, '다른 브랜드 싸이버거', 'thigh-burger', NULL, NULL, 'ACTIVE', '2000-01-01T00:00:00Z');
    `);
    const migration = readFileSync(path.resolve(__dirname, '../src/db/migrations/009_thigh_burger_image.sql'), 'utf8');
    const rows = async () => (await client.query(`
      SELECT id, category_id, brand_id, name, slug, description, image_url, status, updated_at::text
      FROM products ORDER BY id
    `)).rows;

    for (const originalImageUrl of [null, '']) {
      await client.query("UPDATE products SET image_url=$1, updated_at='2000-01-01T00:00:00Z' WHERE id=9", [originalImageUrl]);
      const before = await rows();

      assert.equal((await client.query(migration)).rowCount, 1);
      const after = await rows();
      assert.equal(after[0].image_url, imageUrl);
      assert.notEqual(after[0].updated_at, before[0].updated_at);
      assert.deepEqual(after[0], { ...before[0], image_url: imageUrl, updated_at: after[0].updated_at });
      assert.deepEqual(after.slice(1), before.slice(1), 'other brands and other product slugs stay unchanged');

      const eligible = await listEligibleProducts(client);
      assert.equal(eligible.find((product) => product.productId === '9')?.imageUrl, imageUrl);
      assert.equal(eligible.find((product) => product.productId === '10')?.imageUrl, null);
      assert.equal(eligible.find((product) => product.productId === '11')?.imageUrl, null);

      assert.equal((await client.query(migration)).rowCount, 0);
      assert.deepEqual(await rows(), after, 'rerunning preserves every field, including updated_at');
    }

    const existingImageUrl = 'https://images.example.com/existing-thigh-burger.png';
    await client.query("UPDATE products SET image_url=$1, updated_at='2000-01-01T00:00:00Z' WHERE id=9", [existingImageUrl]);
    const beforeExisting = await rows();
    assert.equal((await client.query(migration)).rowCount, 0);
    assert.deepEqual(await rows(), beforeExisting, 'an existing target image and timestamp are preserved');
    assert.equal((await listEligibleProducts(client)).find((product) => product.productId === '9')?.imageUrl, existingImageUrl);
  } finally {
    client.release(true);
    await pool.end();
  }
});

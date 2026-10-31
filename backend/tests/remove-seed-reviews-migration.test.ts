import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const seeds = [
  [1, '버거박사', 5, '클래식한 특제 소스와 두툼한 더블 패티의 조화가 역시 근본입니다! 🍔'],
  [1, '헬스러버', 4, '단백질 27g 든든하게 챙기기 딱 좋아요. 단성비도 훌륭합니다.'],
  [4, '불맛매니아', 5, '직화 패티 향이 제대로 느껴집니다. 크기도 커서 하나만 먹어도 든든해요.'],
  [4, '치즈러버', 4, '치즈 한 장 추가해서 먹으면 불맛과 치즈 조화가 최고예요!'],
  [13, '치킨버거원탑', 5, '바삭하고 육즙 가득한 통다리살 패티... 가성비와 맛 모두 압도적입니다.'],
] as const;

test('review migrations stop seeding, remove only exact anonymous samples, and preserve other reviews on rerun', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('SET search_path TO pg_temp');
    await client.query('CREATE TEMP TABLE users (id bigint PRIMARY KEY); INSERT INTO users VALUES (99)');
    const initial = readFileSync(path.resolve(__dirname, '../src/db/migrations/006_product_reviews.sql'), 'utf8');
    await client.query(initial.replace('CREATE TABLE IF NOT EXISTS product_reviews', 'CREATE TEMP TABLE product_reviews'));
    assert.equal((await client.query('SELECT * FROM product_reviews')).rowCount, 0, 'fresh databases have no sample reviews');
    for (const seed of seeds) {
      await client.query('INSERT INTO product_reviews (product_id, author_name, rating, content) VALUES ($1, $2, $3, $4)', [...seed]);
    }
    const [productId, author, rating, content] = seeds[0];
    const preserved = await client.query(`
      INSERT INTO product_reviews (product_id, user_id, author_name, rating, content) VALUES
        ($1, 99, $2, $3, $4),
        ($1, NULL, $2, $3, '직접 작성한 리뷰'),
        (999, NULL, $2, $3, $4),
        ($1, NULL, $2, 1, $4)
      RETURNING *
    `, [productId, author, rating, content]);
    const migration = readFileSync(path.resolve(__dirname, '../src/db/migrations/011_remove_seed_reviews.sql'), 'utf8');
    assert.equal((await client.query(migration)).rowCount, seeds.length);
    const remaining = () => client.query('SELECT * FROM product_reviews ORDER BY id');
    assert.deepEqual((await remaining()).rows, preserved.rows);
    assert.equal((await client.query(migration)).rowCount, 0);
    await client.query(initial);
    assert.deepEqual((await remaining()).rows, preserved.rows, 'rerunning all review migrations never recreates samples');
  } finally {
    client.release(true);
    await pool.end();
  }
});

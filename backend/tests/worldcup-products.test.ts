import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { countEligibleProducts } from '../src/repositories/worldcupProducts.js';

// All fixture tables are TEMP tables on one connection; existing data is untouched.
test('PostgreSQL eligibility excludes inactive brands, products and non-burgers', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TEMP TABLE categories (id bigint PRIMARY KEY, slug text);
      CREATE TEMP TABLE brands (id bigint PRIMARY KEY, name text, is_active boolean);
      CREATE TEMP TABLE products (id bigint PRIMARY KEY, category_id bigint, brand_id bigint, name text, description text, image_url text, status text);
      INSERT INTO categories VALUES (1,'burger'),(2,'side');
      INSERT INTO brands VALUES (1,'Active',true),(2,'Inactive',false);
      INSERT INTO products VALUES
        (1,1,1,'Eligible',NULL,NULL,'ACTIVE'),
        (2,1,2,'Inactive brand',NULL,NULL,'ACTIVE'),
        (3,2,1,'Side',NULL,NULL,'ACTIVE'),
        (4,1,1,'Discontinued',NULL,NULL,'DISCONTINUED'),
        (5,1,1,'Upcoming',NULL,NULL,'UPCOMING'),
        (6,1,1,'Temporary',NULL,NULL,'TEMPORARY');
    `);
    assert.equal(await countEligibleProducts(client), 1);
    await client.query("UPDATE products SET status='DISCONTINUED' WHERE id=1");
    assert.equal(await countEligibleProducts(client), 0);
  } finally {
    client.release(true);
    await pool.end();
  }
});

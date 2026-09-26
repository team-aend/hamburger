import type pg from 'pg';
import { getDbPool } from '../db/pool.js';

// Keep eligibility in one query for options and the future session creation API.
export const eligibleProductsQuery = `
  SELECT p.id, p.name, p.description, p.image_url, b.name AS brand_name
  FROM products p
  JOIN brands b ON b.id = p.brand_id
  JOIN categories c ON c.id = p.category_id
  WHERE c.slug = $1 AND p.status = $2 AND b.is_active = TRUE
`;

export async function countEligibleProducts(db: Pick<pg.Pool, 'query'> = getDbPool()): Promise<number> {
  const result = await db.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM (${eligibleProductsQuery}) AS eligible`,
    ['burger', 'ACTIVE'],
  );
  const count = Number(result.rows[0]?.count);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error('Invalid eligible product count');
  }
  return count;
}

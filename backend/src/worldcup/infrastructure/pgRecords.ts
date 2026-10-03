import type pg from 'pg';
import type { ProductStat, WorldcupHistory, WorldcupRecords } from '../application/getRecords.js';

// Each response uses a single SQL statement, so counts and rows share a snapshot.
export class PgWorldcupRecords implements WorldcupRecords {
  constructor(private db: Pick<pg.Pool, 'query'>) {}

  async rankings(): Promise<{ totalResults: number; stats: ProductStat[] }> {
    const result = await this.db.query(`
      WITH completed AS (
        SELECT id, winner_product_id FROM worldcup_sessions WHERE status = 'COMPLETED'
      ), championships AS (
        SELECT winner_product_id AS product_id, COUNT(*)::int AS count
        FROM completed GROUP BY winner_product_id
      ), decisions AS (
        SELECT m.* FROM worldcup_session_matches m JOIN completed s ON s.id = m.session_id
        WHERE m.winner_product_id IS NOT NULL
      ), matches AS (
        SELECT product_id, COUNT(*)::int AS matches, SUM(won)::int AS wins FROM (
          SELECT left_product_id AS product_id, (winner_product_id = left_product_id)::int AS won FROM decisions
          UNION ALL
          SELECT right_product_id, (winner_product_id = right_product_id)::int FROM decisions
        ) played GROUP BY product_id
      ), candidates AS (
        SELECT p.id, p.name, b.name AS brand_name, p.description, p.image_url
        FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories c ON c.id = p.category_id
        WHERE (c.slug = 'burger' AND p.status = 'ACTIVE' AND b.is_active = TRUE)
          OR EXISTS (SELECT 1 FROM worldcup_entries e JOIN completed s ON s.id = e.session_id WHERE e.product_id = p.id)
      )
      SELECT (SELECT COUNT(*)::int FROM completed) AS total,
        COALESCE(jsonb_agg(jsonb_build_object(
          'productId', p.id::text, 'name', p.name, 'brandName', p.brand_name,
          'description', p.description, 'imageUrl', p.image_url,
          'championships', COALESCE(c.count, 0), 'matches', COALESCE(m.matches, 0), 'wins', COALESCE(m.wins, 0)
        ) ORDER BY p.id), '[]'::jsonb) AS stats
      FROM candidates p LEFT JOIN championships c ON c.product_id = p.id LEFT JOIN matches m ON m.product_id = p.id
    `);
    return { totalResults: result.rows[0].total, stats: result.rows[0].stats };
  }

  async history(userId: number): Promise<WorldcupHistory> {
    const result = await this.db.query(`
      WITH completed AS (
        SELECT s.id, s.round_size, s.completed_at, e.product_id,
          jsonb_build_object('productId', e.product_id::text, 'name', e.name,
            'brandName', e.brand_name, 'description', e.description, 'imageUrl', e.image_url) AS product
        FROM worldcup_sessions s JOIN worldcup_entries e ON e.session_id = s.id AND e.product_id = s.winner_product_id
        WHERE s.user_id = $1 AND s.status = 'COMPLETED'
      ), summary AS (
        SELECT product_id, COUNT(*)::int AS count, MAX(completed_at) AS latest
        FROM completed GROUP BY product_id
      ), recent AS (
        SELECT * FROM completed ORDER BY completed_at DESC, id LIMIT 50
      )
      SELECT (SELECT COUNT(*)::int FROM completed) AS total,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('product',
          (SELECT c.product FROM completed c WHERE c.product_id = s.product_id ORDER BY completed_at DESC, id LIMIT 1),
          'count', s.count) ORDER BY s.count DESC, s.latest DESC, s.product_id) FROM summary s), '[]'::jsonb) AS championships,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('sessionId', id::text, 'roundSize', round_size,
          'winner', product, 'createdAt', completed_at) ORDER BY completed_at DESC, id) FROM recent), '[]'::jsonb) AS results
    `, [userId]);
    return result.rows[0];
  }
}

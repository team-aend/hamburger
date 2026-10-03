import type pg from 'pg';
import type { RankingsInput, RankingsRepository, RankingsResult } from '../application/getRankings.js';
import { translateStorageError } from './storageErrors.js';

export class PgRankings implements RankingsRepository {
  constructor(private db: Pick<pg.Pool, 'query'>) {}

  async read(input: RankingsInput): Promise<RankingsResult> {
    const pattern = `%${input.q.replace(/[\\%_]/g, '\\$&')}%`;
    try {
      const result = await this.db.query(`
        WITH completed AS (
          SELECT id, winner_product_id FROM worldcup_sessions
          WHERE status = 'COMPLETED' AND ($1::smallint IS NULL OR round_size = $1)
        ), championships AS (
          SELECT winner_product_id AS product_id, COUNT(*) AS championships
          FROM completed GROUP BY winner_product_id
        ), appearances AS (
          SELECT e.product_id, COUNT(*) AS appearances FROM worldcup_entries e
          JOIN completed s ON s.id = e.session_id GROUP BY e.product_id
        ), decisions AS (
          SELECT m.* FROM worldcup_session_matches m JOIN completed s ON s.id = m.session_id
          WHERE m.winner_product_id IS NOT NULL
        ), played AS (
          SELECT left_product_id AS product_id, (winner_product_id = left_product_id)::int AS won FROM decisions
          UNION ALL
          SELECT right_product_id, (winner_product_id = right_product_id)::int FROM decisions
        ), matches AS (
          SELECT product_id, COUNT(*) AS matches, SUM(won) AS wins FROM played GROUP BY product_id
        ), stats AS (
          SELECT p.id, p.name, b.name AS brand_name, p.image_url, p.status,
            COALESCE(c.championships, 0) AS championships, COALESCE(a.appearances, 0) AS appearances,
            COALESCE(m.matches, 0) AS matches, COALESCE(m.wins, 0) AS wins,
            m.wins::numeric / NULLIF(m.matches, 0) AS rate
          FROM products p JOIN brands b ON b.id = p.brand_id JOIN categories cat ON cat.id = p.category_id
          LEFT JOIN championships c ON c.product_id = p.id
          LEFT JOIN appearances a ON a.product_id = p.id LEFT JOIN matches m ON m.product_id = p.id
          WHERE c.championships >= 1
        ), ranked AS (
          SELECT *, CASE WHEN matches > 0 THEN RANK() OVER (
            ORDER BY (matches > 0) DESC,
              CASE WHEN $2 = 'championships' THEN championships::numeric ELSE rate END DESC NULLS LAST
          ) END AS rank FROM stats
        ), formatted AS (
          SELECT id, name, rank, jsonb_build_object(
            'productId', id::text, 'name', name, 'brandName', brand_name, 'imageUrl', image_url,
            'status', status, 'rank', rank, 'championships', championships, 'appearances', appearances,
            'matches', matches, 'wins', wins, 'winRate', ROUND(rate * 100, 1)
          ) AS item FROM ranked
        ), filtered AS (
          SELECT * FROM formatted WHERE name ILIKE $3 ESCAPE E'\\\\'
        ), page AS (
          SELECT * FROM filtered ORDER BY rank NULLS LAST, id LIMIT $4 OFFSET $5
        )
        SELECT (SELECT COUNT(*)::int FROM completed) AS "completedSessionCount",
          (SELECT COUNT(*)::int FROM filtered) AS "totalCount",
          COALESCE((SELECT jsonb_agg(item ORDER BY rank, id) FROM formatted WHERE rank <= 3), '[]'::jsonb) AS leaders,
          COALESCE((SELECT jsonb_agg(item ORDER BY rank NULLS LAST, id) FROM page), '[]'::jsonb) AS items
      `, [input.roundSize, input.sort, pattern, input.pageSize, (input.page - 1) * input.pageSize]);
      return { sort: input.sort, roundSize: input.roundSize, page: input.page, pageSize: input.pageSize, ...result.rows[0] };
    } catch (error) {
      throw translateStorageError(error);
    }
  }
}

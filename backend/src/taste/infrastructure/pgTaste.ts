import type pg from 'pg';
import type { TasteRepository } from '../application/getTasteReport.js';
import type { TasteProduct, TasteSignals } from '../domain/tasteReport.js';

/** 상품 1개의 취향 속성 (단품 매장가, 단품 열량, 패티 이름) → TasteProduct 모양의 JSON */
const PRODUCT_ATTRS = `
  attrs AS (
    SELECT p.id AS product_id, jsonb_build_object(
      'productId', p.id::text, 'name', p.name, 'brandName', b.name,
      'singlePrice', (SELECT pp.price FROM product_prices pp
                       WHERE pp.product_variant_id = sv.id AND pp.channel = 'STORE' AND pp.ended_at IS NULL),
      'caloriesKcal', (SELECT n.calories_kcal::float FROM nutrition n WHERE n.product_variant_id = sv.id),
      'patties', COALESCE((SELECT jsonb_agg(i.name ORDER BY pi.sort_order)
                             FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id
                            WHERE pi.product_id = p.id AND i.ingredient_group = 'PATTY'), '[]'::jsonb)
    ) AS product, p.status, b.is_active AS brand_active
    FROM products p
    JOIN brands b ON b.id = p.brand_id
    LEFT JOIN LATERAL (
      SELECT v.id FROM product_variants v WHERE v.product_id = p.id AND v.is_active
      ORDER BY (v.variant_type = 'SINGLE') DESC, v.is_default DESC, v.id LIMIT 1
    ) sv ON TRUE
  )`;

export class PgTaste implements TasteRepository {
  constructor(private db: Pick<pg.Pool, 'query'>) {}

  async signals(userId: number): Promise<TasteSignals> {
    const { rows } = await this.db.query(`
      WITH ${PRODUCT_ATTRS}
      SELECT
        COALESCE((SELECT jsonb_agg(a.product ORDER BY l.created_at DESC)
                    FROM product_likes l JOIN attrs a ON a.product_id = l.product_id
                   WHERE l.user_id = $1), '[]'::jsonb) AS likes,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('product', a.product, 'count', w.count))
                    FROM (SELECT winner_product_id, COUNT(*)::int AS count FROM worldcup_sessions
                           WHERE user_id = $1 AND status = 'COMPLETED' GROUP BY winner_product_id) w
                    JOIN attrs a ON a.product_id = w.winner_product_id), '[]'::jsonb) AS wins,
        COALESCE((SELECT jsonb_agg(a.product)
                    FROM (SELECT DISTINCT product_id FROM product_reviews WHERE user_id = $1 AND rating >= 4) r
                    JOIN attrs a ON a.product_id = r.product_id), '[]'::jsonb) AS ratings
    `, [userId]);
    return { likes: rows[0].likes, worldcupWins: rows[0].wins, highRatings: rows[0].ratings };
  }

  async candidates(): Promise<TasteProduct[]> {
    const { rows } = await this.db.query(`
      WITH ${PRODUCT_ATTRS}
      SELECT COALESCE(jsonb_agg(product ORDER BY product_id), '[]'::jsonb) AS products
        FROM attrs WHERE status = 'ACTIVE' AND brand_active
    `);
    return rows[0].products;
  }
}

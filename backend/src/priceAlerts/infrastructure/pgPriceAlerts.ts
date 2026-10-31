import type pg from 'pg';
import type { PriceAlertsRepository } from '../application/priceAlerts.js';
import type { LikedPriceSnapshot } from '../domain/priceChange.js';

/**
 * 상품마다 단품(SINGLE) variant 하나의 매장가(STORE)만 본다. (없으면 기본 variant)
 * 한 SQL 로 스냅샷과 확인 시각을 함께 읽어 같은 시점의 값을 보장한다.
 */
export class PgPriceAlerts implements PriceAlertsRepository {
  constructor(private db: Pick<pg.Pool, 'query'>) {}

  async likedSnapshots(userId: number): Promise<{ snapshots: LikedPriceSnapshot[]; seenAt: string | null }> {
    const { rows } = await this.db.query(
      `WITH liked AS (
         SELECT product_id, created_at AS liked_at FROM product_likes WHERE user_id = $1
       ), variant AS (
         SELECT DISTINCT ON (v.product_id) v.product_id, v.id AS variant_id, l.liked_at
           FROM product_variants v JOIN liked l ON l.product_id = v.product_id
          WHERE v.is_active
          ORDER BY v.product_id, (v.variant_type = 'SINGLE') DESC, v.is_default DESC, v.id
       ), snapshot AS (
         SELECT v.product_id,
                (SELECT pp.price FROM product_prices pp
                  WHERE pp.product_variant_id = v.variant_id AND pp.channel = 'STORE' AND pp.started_at <= v.liked_at
                  ORDER BY pp.started_at DESC, pp.id DESC LIMIT 1) AS price_at_like,
                cur.price AS current_price, cur.started_at AS current_since
           FROM variant v
           LEFT JOIN product_prices cur
             ON cur.product_variant_id = v.variant_id AND cur.channel = 'STORE' AND cur.ended_at IS NULL
       )
       SELECT (SELECT price_alerts_seen_at FROM users WHERE id = $1) AS seen_at,
              COALESCE(jsonb_agg(jsonb_build_object(
                'productId', product_id::text, 'priceAtLike', price_at_like,
                'currentPrice', current_price, 'currentSince', current_since
              ) ORDER BY product_id) FILTER (WHERE product_id IS NOT NULL), '[]'::jsonb) AS snapshots
         FROM snapshot`,
      [userId],
    );
    const row = rows[0];
    return {
      seenAt: row.seen_at ? new Date(row.seen_at).toISOString() : null,
      snapshots: (row.snapshots as LikedPriceSnapshot[]).map((s) => ({
        ...s,
        currentSince: s.currentSince ? new Date(s.currentSince).toISOString() : null,
      })),
    };
  }

  async markSeen(userId: number): Promise<void> {
    await this.db.query('UPDATE users SET price_alerts_seen_at = NOW() WHERE id = $1', [userId]);
  }
}

import type pg from 'pg';
import {
  ProductsStorageUnavailable,
  type ProductDetail,
  type ProductDetailRepository,
} from '../application/getProductDetail.js';
import type { SimilarCandidate } from '../domain/similarProducts.js';

const num = (value: unknown): number | null => (value === null || value === undefined ? null : Number(value));
const iso = (value: unknown): string => new Date(value as string).toISOString();

const DATABASE_FAILURE_CODES = new Set([
  'ECONNREFUSED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'EPIPE',
  '57P01', '57P02', '57P03', '53300', '53400', '57014', '55P03',
]);

/** 연결·용량·타임아웃 오류는 "저장소 사용 불가"(503)로, 그 밖의 오류는 그대로 던진다. */
function translate(error: unknown): never {
  const code = (error as { code?: string } | null)?.code;
  const unavailable = Boolean(typeof code === 'string' && (DATABASE_FAILURE_CODES.has(code) || code.startsWith('08'))) ||
    (error instanceof Error && /timeout|connection terminated/i.test(error.message));
  throw unavailable ? new ProductsStorageUnavailable() : error;
}

export class PgProductDetail implements ProductDetailRepository {
  constructor(private db: Pick<pg.Pool, 'query'>) {}

  async findDetail(productId: string, userId: number | null): Promise<Omit<ProductDetail, 'similar'> | null> {
    try {
      const productRes = await this.db.query(
        `SELECT p.id::text AS id, p.name, p.slug, p.description, p.image_url, p.status, p.is_limited,
                b.id::text AS brand_id, b.name AS brand_name, b.slug AS brand_slug, b.logo_url,
                c.name AS category_name
           FROM products p
           JOIN brands b ON b.id = p.brand_id
           JOIN categories c ON c.id = p.category_id
          WHERE p.id = $1::bigint`,
        [productId],
      );
      const product = productRes.rows[0];
      if (!product) return null;

      const [variants, prices, ingredients, tags, likes, reviews, worldcup] = await Promise.all([
        this.db.query(
          `SELECT v.id::text AS id, v.name, v.variant_type, v.is_default,
                  n.serving_size_g, n.calories_kcal, n.protein_g, n.sugar_g, n.saturated_fat_g, n.sodium_mg
             FROM product_variants v LEFT JOIN nutrition n ON n.product_variant_id = v.id
            WHERE v.product_id = $1::bigint AND v.is_active
            ORDER BY (v.variant_type = 'SINGLE') DESC, v.is_default DESC, v.id`,
          [productId],
        ),
        this.db.query(
          `SELECT pp.product_variant_id::text AS variant_id, pp.channel, pp.price, pp.started_at, pp.ended_at
             FROM product_prices pp JOIN product_variants v ON v.id = pp.product_variant_id
            WHERE v.product_id = $1::bigint
            ORDER BY pp.started_at, pp.id`,
          [productId],
        ),
        this.db.query(
          `SELECT i.name, i.slug, i.ingredient_group
             FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id
            WHERE pi.product_id = $1::bigint ORDER BY pi.sort_order`,
          [productId],
        ),
        this.db.query(
          `SELECT t.name, t.slug FROM product_tags pt JOIN tags t ON t.id = pt.tag_id
            WHERE pt.product_id = $1::bigint ORDER BY t.id`,
          [productId],
        ),
        this.db.query(
          `SELECT COUNT(*)::int AS count, COALESCE(BOOL_OR(user_id = $2), false) AS liked
             FROM product_likes WHERE product_id = $1::bigint`,
          [productId, userId],
        ),
        this.db.query(
          `SELECT COUNT(*)::int AS count, COALESCE(ROUND(AVG(rating), 1), 0) AS avg
             FROM product_reviews WHERE product_id = $1::bigint`,
          [productId],
        ),
        this.db.query(
          `WITH completed AS (
             SELECT id, winner_product_id FROM worldcup_sessions WHERE status = 'COMPLETED'
           ), ranked AS (
             SELECT winner_product_id AS product_id, COUNT(*)::int AS championships,
                    RANK() OVER (ORDER BY COUNT(*) DESC)::int AS rank
               FROM completed GROUP BY winner_product_id
           ), decisions AS (
             SELECT m.winner_product_id FROM worldcup_session_matches m JOIN completed s ON s.id = m.session_id
              WHERE m.winner_product_id IS NOT NULL AND $1::bigint IN (m.left_product_id, m.right_product_id)
           )
           SELECT COALESCE((SELECT championships FROM ranked WHERE product_id = $1::bigint), 0) AS championships,
                  (SELECT rank FROM ranked WHERE product_id = $1::bigint) AS rank,
                  (SELECT COUNT(*)::int FROM worldcup_entries e JOIN completed s ON s.id = e.session_id
                    WHERE e.product_id = $1::bigint) AS appearances,
                  (SELECT COUNT(*)::int FROM decisions) AS matches,
                  (SELECT COUNT(*)::int FROM decisions WHERE winner_product_id = $1::bigint) AS wins`,
          [productId],
        ),
      ]);

      const current = new Map<string, number>();
      for (const row of prices.rows) {
        if (row.ended_at === null) current.set(`${row.variant_id}:${row.channel}`, Number(row.price));
      }
      const wc = worldcup.rows[0];

      return {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        description: product.description ?? '',
        imageUrl: product.image_url,
        status: product.status,
        isLimited: Boolean(product.is_limited),
        brand: { brandId: product.brand_id, name: product.brand_name, slug: product.brand_slug, logoUrl: product.logo_url },
        category: product.category_name,
        ingredients: ingredients.rows.map((r) => ({ name: r.name, slug: r.slug, group: r.ingredient_group })),
        tags: tags.rows.map((r) => ({ name: r.name, slug: r.slug })),
        variants: variants.rows.map((r) => ({
          variantId: r.id,
          name: r.name,
          variantType: r.variant_type,
          isDefault: Boolean(r.is_default),
          prices: { store: current.get(`${r.id}:STORE`) ?? null, delivery: current.get(`${r.id}:DELIVERY`) ?? null },
          nutrition: r.calories_kcal === null ? null : {
            servingSizeG: num(r.serving_size_g),
            caloriesKcal: num(r.calories_kcal),
            proteinG: num(r.protein_g),
            sugarG: num(r.sugar_g),
            saturatedFatG: num(r.saturated_fat_g),
            sodiumMg: num(r.sodium_mg),
          },
        })),
        priceHistory: prices.rows.map((r) => ({
          variantId: r.variant_id,
          channel: r.channel,
          price: Number(r.price),
          startedAt: iso(r.started_at),
          endedAt: r.ended_at ? iso(r.ended_at) : null,
        })),
        likes: { count: likes.rows[0].count, liked: likes.rows[0].liked },
        reviews: { averageRating: Number(reviews.rows[0].avg), totalCount: reviews.rows[0].count },
        worldcup: { championships: wc.championships, appearances: wc.appearances, matches: wc.matches, wins: wc.wins, rank: wc.rank },
      };
    } catch (error) {
      translate(error);
    }
  }

  async listSimilarCandidates(): Promise<SimilarCandidate[]> {
    try {
      const { rows } = await this.db.query(
        `WITH single AS (
           SELECT DISTINCT ON (v.product_id) v.product_id, v.id AS variant_id
             FROM product_variants v WHERE v.is_active
            ORDER BY v.product_id, (v.variant_type = 'SINGLE') DESC, v.is_default DESC, v.id
         )
         SELECT p.id::text AS id, p.name, b.name AS brand_name,
                (SELECT pp.price FROM product_prices pp
                  WHERE pp.product_variant_id = s.variant_id AND pp.channel = 'STORE' AND pp.ended_at IS NULL) AS price,
                (SELECT n.calories_kcal FROM nutrition n WHERE n.product_variant_id = s.variant_id) AS kcal,
                COALESCE((SELECT jsonb_agg(jsonb_build_object('slug', i.slug, 'name', i.name) ORDER BY pi.sort_order)
                            FROM product_ingredients pi JOIN ingredients i ON i.id = pi.ingredient_id
                           WHERE pi.product_id = p.id AND i.ingredient_group = 'PATTY'), '[]'::jsonb) AS patties
           FROM products p
           JOIN brands b ON b.id = p.brand_id AND b.is_active
           LEFT JOIN single s ON s.product_id = p.id
          WHERE p.status = 'ACTIVE'
          ORDER BY p.id`,
      );
      return rows.map((r) => ({
        productId: r.id,
        name: r.name,
        brandName: r.brand_name,
        singlePrice: num(r.price),
        caloriesKcal: num(r.kcal),
        patties: r.patties,
      }));
    } catch (error) {
      translate(error);
    }
  }
}

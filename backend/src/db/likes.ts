import { getDbPool } from './pool.js';

export interface LikeSummary {
  /** 상품 id -> 좋아요 수 (0개인 상품은 빠짐) */
  counts: Record<number, number>;
  /** 로그인 사용자가 좋아요한 상품 id (비로그인이면 빈 배열) */
  likedProductIds: number[];
}

export class ProductNotFoundError extends Error {}

export async function getLikeSummary(
  productIds: number[],
  userId: number | null
): Promise<LikeSummary> {
  if (productIds.length === 0) return { counts: {}, likedProductIds: [] };
  const pool = getDbPool();

  const [countsRes, likedRes] = await Promise.all([
    pool.query(
      `SELECT product_id, COUNT(*)::int AS count
         FROM product_likes
        WHERE product_id = ANY($1::bigint[])
        GROUP BY product_id`,
      [productIds]
    ),
    userId === null
      ? Promise.resolve({ rows: [] as { product_id: string }[] })
      : pool.query(
          `SELECT product_id FROM product_likes
            WHERE user_id = $1 AND product_id = ANY($2::bigint[])`,
          [userId, productIds]
        ),
  ]);

  return {
    counts: Object.fromEntries(
      countsRes.rows.map((row) => [Number(row.product_id), row.count])
    ),
    likedProductIds: likedRes.rows.map((row) => Number(row.product_id)),
  };
}

/**
 * 좋아요 설정/해제. 같은 요청을 여러 번 보내도 결과가 같다(멱등).
 * 반환값은 변경 후 상태와 해당 상품의 전체 좋아요 수.
 */
export async function setProductLike(
  userId: number,
  productId: number,
  liked: boolean
): Promise<{ liked: boolean; count: number }> {
  const pool = getDbPool();
  try {
    if (liked) {
      await pool.query(
        `INSERT INTO product_likes (user_id, product_id)
         VALUES ($1, $2)
         ON CONFLICT (user_id, product_id) DO NOTHING`,
        [userId, productId]
      );
    } else {
      await pool.query(
        'DELETE FROM product_likes WHERE user_id = $1 AND product_id = $2',
        [userId, productId]
      );
    }
  } catch (error) {
    // 23503: 외래키 위반 = 존재하지 않는 상품
    if ((error as { code?: string }).code === '23503') {
      throw new ProductNotFoundError(`상품(${productId})을 찾을 수 없습니다.`);
    }
    throw error;
  }

  const { rows } = await pool.query(
    'SELECT COUNT(*)::int AS count FROM product_likes WHERE product_id = $1',
    [productId]
  );
  return { liked, count: rows[0].count };
}

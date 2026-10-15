import { getDbPool } from './pool.js';

export interface ProductReview {
  id: number;
  productId: number;
  userId: number | null;
  authorName: string;
  rating: number;
  content: string;
  createdAt: string;
}

export interface ReviewsSummary {
  averageRating: number;
  totalCount: number;
}

export async function getReviewsSummary(
  productIds: number[]
): Promise<Record<number, ReviewsSummary>> {
  if (productIds.length === 0) return {};
  const pool = getDbPool();

  const res = await pool.query<{
    product_id: string;
    avg_rating: string;
    total_count: number;
  }>(
    `SELECT
       product_id,
       ROUND(AVG(rating)::numeric, 1)::text as avg_rating,
       COUNT(*)::int as total_count
     FROM product_reviews
     WHERE product_id = ANY($1::bigint[])
     GROUP BY product_id`,
    [productIds]
  );

  const summary: Record<number, ReviewsSummary> = {};
  for (const row of res.rows) {
    summary[Number(row.product_id)] = {
      averageRating: Number(row.avg_rating),
      totalCount: Number(row.total_count),
    };
  }
  return summary;
}

export async function getProductReviews(productId: number): Promise<{
  productId: number;
  averageRating: number;
  totalCount: number;
  reviews: ProductReview[];
}> {
  const pool = getDbPool();

  const res = await pool.query<{
    id: string;
    product_id: string;
    user_id: string | null;
    author_name: string;
    rating: number;
    content: string;
    created_at: Date;
  }>(
    `SELECT id, product_id, user_id, author_name, rating, content, created_at
     FROM product_reviews
     WHERE product_id = $1
     ORDER BY created_at DESC`,
    [productId]
  );

  const reviews: ProductReview[] = res.rows.map((row) => ({
    id: Number(row.id),
    productId: Number(row.product_id),
    userId: row.user_id !== null ? Number(row.user_id) : null,
    authorName: row.author_name,
    rating: Number(row.rating),
    content: row.content,
    createdAt: row.created_at.toISOString(),
  }));

  const totalCount = reviews.length;
  const averageRating =
    totalCount > 0
      ? Number(
          (
            reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalCount
          ).toFixed(1)
        )
      : 0;

  return {
    productId,
    averageRating,
    totalCount,
    reviews,
  };
}

export async function createProductReview(input: {
  productId: number;
  userId?: number | null;
  authorName: string;
  rating: number;
  content: string;
}): Promise<ProductReview> {
  const rating = Math.round(Number(input.rating));
  if (rating < 1 || rating > 5) {
    throw new Error('평점은 1점부터 5점 사이여야 합니다.');
  }

  const content = input.content.trim();
  if (content.length === 0) {
    throw new Error('한 줄 평 내용을 입력해 주세요.');
  }
  if (content.length > 200) {
    throw new Error('한 줄 평은 최대 200자까지 작성할 수 있습니다.');
  }

  const authorName = input.authorName.trim() || '익명 버거러버';
  const pool = getDbPool();

  const res = await pool.query<{
    id: string;
    product_id: string;
    user_id: string | null;
    author_name: string;
    rating: number;
    content: string;
    created_at: Date;
  }>(
    `INSERT INTO product_reviews (product_id, user_id, author_name, rating, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, product_id, user_id, author_name, rating, content, created_at`,
    [input.productId, input.userId ?? null, authorName, rating, content]
  );

  const row = res.rows[0];
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    userId: row.user_id !== null ? Number(row.user_id) : null,
    authorName: row.author_name,
    rating: Number(row.rating),
    content: row.content,
    createdAt: row.created_at.toISOString(),
  };
}

export async function deleteProductReview(
  reviewId: number,
  userId: number
): Promise<boolean> {
  const pool = getDbPool();
  const res = await pool.query(
    `DELETE FROM product_reviews
     WHERE id = $1 AND user_id = $2`,
    [reviewId, userId]
  );
  return (res.rowCount ?? 0) > 0;
}

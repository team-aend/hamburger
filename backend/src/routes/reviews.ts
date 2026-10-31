import { Router, Request, Response } from 'express';
import { optionalAuth, requireAuth } from '../auth/middleware.js';
import {
  createProductReview,
  deleteProductReview,
  getProductReviews,
  getReviewsSummary,
} from '../db/reviews.js';

const router = Router();

function parseId(value: unknown): number | null {
  const num = Number(value);
  return Number.isSafeInteger(num) && num > 0 ? num : null;
}

/**
 * GET /api/reviews/summary?productIds=1,2,3
 * 상품 목록용 평점 및 리뷰 수 요약
 */
router.get('/summary', async (req: Request, res: Response) => {
  const raw = typeof req.query.productIds === 'string' ? req.query.productIds : '';
  const productIds = [
    ...new Set(
      raw
        .split(',')
        .map((val) => parseId(val.trim()))
        .filter((id): id is number => id !== null)
    ),
  ].slice(0, 100);

  try {
    const summary = await getReviewsSummary(productIds);
    res.set('Cache-Control', 'no-store');
    res.status(200).json({ summary });
  } catch (error) {
    console.error('❌ 리뷰 요약 조회 오류:', error);
    res.status(500).json({ message: '리뷰 요약을 불러오지 못했습니다.' });
  }
});

/**
 * GET /api/reviews/:productId
 * 특정 상품의 전체 한 줄 평 및 평균 평점
 */
router.get('/:productId', async (req: Request, res: Response) => {
  const productId = parseId(req.params.productId);
  if (productId === null) {
    res.status(400).json({ message: '올바르지 않은 상품 ID입니다.' });
    return;
  }

  try {
    const data = await getProductReviews(productId);
    res.set('Cache-Control', 'no-store');
    res.status(200).json(data);
  } catch (error) {
    console.error('❌ 상품 리뷰 조회 오류:', error);
    res.status(500).json({ message: '리뷰를 불러오지 못했습니다.' });
  }
});

/**
 * POST /api/reviews/:productId
 * 한 줄 평 등록 (로그인 필수 - 악성 댓글 및 무분별한 도배 방지)
 */
router.post('/:productId', requireAuth, async (req: Request, res: Response) => {
  const productId = parseId(req.params.productId);
  if (productId === null) {
    res.status(400).json({ message: '올바르지 않은 상품 ID입니다.' });
    return;
  }

  const { rating, content } = req.body ?? {};
  const authorName = req.user!.displayName;

  try {
    const review = await createProductReview({
      productId,
      userId: req.user!.id,
      authorName,
      rating: Number(rating),
      content: String(content ?? ''),
    });

    res.status(201).json({
      message: '한 줄 평이 등록되었습니다.',
      review,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : '리뷰 등록에 실패했습니다.';
    res.status(400).json({ message: msg });
  }
});

/**
 * DELETE /api/reviews/:reviewId
 * 작성자 본인의 한 줄 평 삭제 (로그인 필수)
 */
router.delete('/:reviewId', requireAuth, async (req: Request, res: Response) => {
  const reviewId = parseId(req.params.reviewId);
  if (reviewId === null) {
    res.status(400).json({ message: '올바르지 않은 리뷰 ID입니다.' });
    return;
  }

  try {
    const deleted = await deleteProductReview(reviewId, req.user!.id);
    if (!deleted) {
      res.status(404).json({ message: '삭제할 수 없거나 본인 작성 리뷰가 아닙니다.' });
      return;
    }

    res.status(200).json({ message: '한 줄 평이 삭제되었습니다.' });
  } catch (error) {
    console.error('❌ 리뷰 삭제 오류:', error);
    res.status(500).json({ message: '리뷰 삭제 중 오류가 발생했습니다.' });
  }
});

export default router;

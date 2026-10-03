import { Router, Request, Response } from 'express';
import { optionalAuth, requireAuth } from '../auth/middleware.js';
import {
  getLikeSummary,
  ProductNotFoundError,
  setProductLike,
} from '../db/likes.js';

const router = Router();

const MAX_PRODUCT_IDS = 200;

function parseProductId(value: string): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

/**
 * GET /api/likes?productIds=1,2,3
 * 상품별 좋아요 수 + (로그인 시) 내가 좋아요한 상품 id. 비로그인도 조회 가능.
 */
router.get('/', optionalAuth, async (req: Request, res: Response) => {
  const raw = typeof req.query.productIds === 'string' ? req.query.productIds : '';
  const productIds = [
    ...new Set(
      raw
        .split(',')
        .map((value) => parseProductId(value.trim()))
        .filter((id): id is number => id !== null)
    ),
  ].slice(0, MAX_PRODUCT_IDS);

  try {
    const summary = await getLikeSummary(productIds, req.user?.id ?? null);
    res.set('Cache-Control', 'no-store');
    res.status(200).json(summary);
  } catch (error) {
    console.error('❌ 좋아요 조회 오류:', error);
    res.status(500).json({ message: '좋아요 정보를 불러오지 못했습니다.' });
  }
});

/**
 * PUT    /api/likes/:productId  좋아요
 * DELETE /api/likes/:productId  좋아요 취소
 * 로그인 필수. 응답: { liked, count }
 */
async function handleSetLike(req: Request, res: Response, liked: boolean) {
  const productId = parseProductId(String(req.params.productId));
  if (productId === null) {
    res.status(400).json({ message: '올바르지 않은 상품 id 입니다.' });
    return;
  }

  try {
    res.status(200).json(await setProductLike(req.user!.id, productId, liked));
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      res.status(404).json({ message: error.message });
      return;
    }
    console.error('❌ 좋아요 저장 오류:', error);
    res.status(500).json({ message: '좋아요를 저장하지 못했습니다.' });
  }
}

router.put('/:productId', requireAuth, (req, res) => handleSetLike(req, res, true));
router.delete('/:productId', requireAuth, (req, res) => handleSetLike(req, res, false));

export default router;

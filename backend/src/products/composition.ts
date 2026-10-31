import { Router } from 'express';
import { optionalAuth } from '../auth/middleware.js';
import { getDbPool, isDbConfigured } from '../db/pool.js';
import { createGetProductDetail } from './application/getProductDetail.js';
import { PgProductDetail } from './infrastructure/pgProductDetail.js';
import { createProductDetailHandler } from './presentation/productDetailHandler.js';

/**
 * 상품 API. DB 는 요청 시점에 연결한다. (모듈 import 만으로 연결하지 않음)
 *   GET /api/products/images      DB에 등록된 상품 이미지 목록 조회
 *   GET /api/products/:productId  상세 (비로그인 가능, 로그인 시 내 좋아요 여부 포함)
 */
export function createProductsRouter() {
  const router = Router();

  router.get('/images', async (_req, res) => {
    if (!isDbConfigured()) {
      res.status(200).json({ items: [] });
      return;
    }
    try {
      const { rows } = await getDbPool().query(
        `SELECT p.id::int AS id, p.name, p.slug, p.image_url AS "imageUrl"
           FROM products p
          WHERE p.image_url IS NOT NULL AND p.image_url <> ''
          ORDER BY p.id`,
      );
      res.status(200).json({ items: rows });
    } catch (error) {
      res.status(500).json({
        message: '상품 이미지를 불러오지 못했습니다.',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  router.get('/:productId', optionalAuth, createProductDetailHandler(
    (productId, userId) => createGetProductDetail(new PgProductDetail(getDbPool()))(productId, userId),
    isDbConfigured,
  ));
  return router;
}

import { Router } from 'express';
import { optionalAuth } from '../auth/middleware.js';
import { getDbPool, isDbConfigured } from '../db/pool.js';
import { createGetProductDetail } from './application/getProductDetail.js';
import { PgProductDetail } from './infrastructure/pgProductDetail.js';
import { createProductDetailHandler } from './presentation/productDetailHandler.js';

/**
 * 상품 API. DB 는 요청 시점에 연결한다. (모듈 import 만으로 연결하지 않음)
 *   GET /api/products/:productId  상세 (비로그인 가능, 로그인 시 내 좋아요 여부 포함)
 */
export function createProductsRouter() {
  const router = Router();
  router.get('/:productId', optionalAuth, createProductDetailHandler(
    (productId, userId) => createGetProductDetail(new PgProductDetail(getDbPool()))(productId, userId),
    isDbConfigured,
  ));
  return router;
}

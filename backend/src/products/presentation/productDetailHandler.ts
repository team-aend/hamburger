import type { Request, Response } from 'express';
import { ProductsStorageUnavailable, type ProductDetail } from '../application/getProductDetail.js';

/** PostgreSQL BIGINT 범위의 양의 정수 문자열만 허용한다. (상품 ID 는 문자열로 보존) */
export function parseProductId(value: unknown): string | null {
  return typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value) && BigInt(value) <= 9223372036854775807n
    ? value
    : null;
}

export function createProductDetailHandler(
  getDetail: (productId: string, userId: number | null) => Promise<ProductDetail | null>,
  configured: () => boolean,
) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const productId = parseProductId(req.params.productId);
    if (!productId) {
      res.status(400).json({ error: { code: 'INVALID_PRODUCT_ID', message: '상품 번호를 확인해 주세요.' } });
      return;
    }
    try {
      if (!configured()) throw new ProductsStorageUnavailable();
      const product = await getDetail(productId, req.user?.id ?? null);
      if (!product) {
        res.status(404).json({ error: { code: 'PRODUCT_NOT_FOUND', message: '상품을 찾을 수 없습니다.' } });
        return;
      }
      res.status(200).json({ product });
    } catch (error) {
      const unavailable = error instanceof ProductsStorageUnavailable;
      if (!unavailable) console.error('PRODUCT_DETAIL_ERROR');
      res.status(unavailable ? 503 : 500).json({ error: {
        code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
        message: '상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      } });
    }
  };
}

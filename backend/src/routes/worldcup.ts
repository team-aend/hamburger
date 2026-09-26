import { Router, type Request, type Response } from 'express';
import { isDbConfigured } from '../db/pool.js';
import { countEligibleProducts } from '../repositories/worldcupProducts.js';
import { buildWorldcupOptions } from '../services/worldcupOptions.js';

export function createOptionsHandler(
  countProducts: () => Promise<number> = countEligibleProducts,
  configured: () => boolean = isDbConfigured,
) {
  return async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!configured()) {
      res.status(503).json({ error: {
        code: 'DATABASE_NOT_CONFIGURED',
        message: '데이터베이스 연결 설정이 필요합니다.',
      } });
      return;
    }
    let count: number;
    try {
      count = await countProducts();
    } catch {
      res.status(503).json({ error: {
        code: 'DATABASE_UNAVAILABLE',
        message: '참가 가능한 버거를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      } });
      return;
    }
    res.status(200).json(buildWorldcupOptions(count));
  };
}

const router = Router();
router.get('/options', createOptionsHandler());
export default router;

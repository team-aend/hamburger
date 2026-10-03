import { Router, type Request, type Response } from 'express';
import { isDbConfigured } from '../db/pool.js';
import { countEligibleProducts } from '../repositories/worldcupProducts.js';
import { buildWorldcupOptions } from '../services/worldcupOptions.js';
import { requireAuth } from '../auth/middleware.js';
import { createStartSessionHandler } from './worldcupSessions.js';
import {
  getWorldcupRankingStats,
  saveWorldcupResult,
  validateWorldcupResult,
  WorldcupRateLimitError,
  WorldcupValidationError,
} from '../db/worldcup.js';

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
/**
 * POST /api/worldcup/sessions (로그인 선택)
 * body: { roundSize: 8 | 16 }, headers: Origin, Idempotency-Key(UUID).
 * Without an owner cookie: 428 + Set-Cookie, retry once with the same key.
 * A new session returns 201; the same owner's identical retry returns 200.
 */
router.post('/sessions', createStartSessionHandler());

/**
 * POST /api/worldcup/results  (로그인 필수)
 * body: { roundSize: 8 | 16, winnerBurgerId, matches: [{ round, winner, loser }] }
 */
router.post('/results', requireAuth, async (req: Request, res: Response) => {
  try {
    const input = validateWorldcupResult(req.body);
    const saved = await saveWorldcupResult(req.user!.id, input);
    res.status(201).json(saved);
  } catch (error) {
    if (error instanceof WorldcupValidationError) {
      res.status(400).json({ message: error.message });
      return;
    }
    if (error instanceof WorldcupRateLimitError) {
      res.status(429).json({ message: error.message });
      return;
    }
    console.error('❌ 월드컵 결과 저장 오류:', error);
    res.status(500).json({ message: '월드컵 결과를 저장하지 못했습니다.' });
  }
});

/**
 * GET /api/worldcup/rankings
 * 버거별 우승 횟수 / 대결 수 / 대결 승리 수 (로그인 회원 결과 집계, 비로그인도 조회 가능)
 */
router.get('/rankings', async (_req: Request, res: Response) => {
  try {
    res.set('Cache-Control', 'no-store');
    res.status(200).json(await getWorldcupRankingStats());
  } catch (error) {
    console.error('❌ 월드컵 랭킹 조회 오류:', error);
    res.status(500).json({ message: '랭킹을 불러오지 못했습니다.' });
  }
});

export default router;

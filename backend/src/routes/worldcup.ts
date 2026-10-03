import { Router, type Request, type Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { createWorldcupRouter } from '../worldcup/composition.js';
import {
  getWorldcupRankingStats,
  saveWorldcupResult,
  validateWorldcupResult,
  WorldcupRateLimitError,
  WorldcupValidationError,
} from '../db/worldcup.js';

const router = Router();
router.use(createWorldcupRouter());

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

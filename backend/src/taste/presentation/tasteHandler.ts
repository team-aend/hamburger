import type { Request, Response } from 'express';
import type { TasteReport } from '../domain/tasteReport.js';

/** GET /api/me/taste — 로그인 필수 라우터(requireAuth) 뒤에 연결한다. */
export function createTasteHandler(getReport: (userId: number) => Promise<TasteReport>) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      res.status(200).json(await getReport(req.user!.id));
    } catch {
      console.error('TASTE_REPORT_ERROR');
      res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '취향 리포트를 만들지 못했습니다.' } });
    }
  };
}

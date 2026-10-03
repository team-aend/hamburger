import type { Request, Response } from 'express';
import type { createGetWorldcupOptions } from '../application/getOptions.js';

export function createOptionsHandler(
  getOptions: ReturnType<typeof createGetWorldcupOptions>,
  configured: () => boolean,
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
    try {
      res.status(200).json(await getOptions());
    } catch {
      res.status(503).json({ error: {
        code: 'DATABASE_UNAVAILABLE',
        message: '참가 가능한 버거를 조회하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      } });
    }
  };
}

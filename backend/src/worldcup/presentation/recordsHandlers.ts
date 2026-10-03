import type { Request, Response } from 'express';
import type { createGetRecords } from '../application/getRecords.js';

export function createRecordsHandlers(records: ReturnType<typeof createGetRecords>) {
  const handler = (read: (req: Request) => Promise<unknown>, privateResponse: boolean) =>
    async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', privateResponse ? 'private, no-store' : 'no-store');
      try {
        res.status(200).json(await read(req));
      } catch {
        res.status(503).json({ message: '월드컵 기록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' });
      }
    };
  return {
    rankings: handler(() => records.rankings(), false),
    history: handler((req) => records.history(req.user!.id), true),
  };
}

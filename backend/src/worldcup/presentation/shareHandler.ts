import type { Request, Response } from 'express';
import type { WorldcupShare } from '../application/getShare.js';
import { WorldcupStorageUnavailable } from '../application/ports.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * GET /api/worldcup/share/:sessionId — 공유 링크용 완료 결과 (누구나 조회 가능).
 * 세션 ID 는 추측할 수 없는 UUID 이고, 응답에는 소유자·회원 정보가 없다.
 * 완료되지 않았거나 없는 세션은 구분하지 않고 404 로 응답한다.
 */
export function createShareHandler(getShare: (sessionId: string) => Promise<WorldcupShare | null>, configured: () => boolean) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const sessionId = req.params.sessionId;
    if (typeof sessionId !== 'string' || !UUID.test(sessionId)) {
      res.status(400).json({ error: { code: 'INVALID_ID', message: '공유 링크가 올바르지 않습니다.' } });
      return;
    }
    try {
      if (!configured()) throw new WorldcupStorageUnavailable();
      const share = await getShare(sessionId.toLowerCase());
      if (!share) {
        res.status(404).json({ error: { code: 'SHARE_NOT_FOUND', message: '공유할 수 있는 월드컵 결과가 없습니다.' } });
        return;
      }
      res.status(200).json(share);
    } catch (error) {
      const unavailable = error instanceof WorldcupStorageUnavailable;
      res.status(unavailable ? 503 : 500).json({ error: {
        code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
        message: '월드컵 결과를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      } });
    }
  };
}

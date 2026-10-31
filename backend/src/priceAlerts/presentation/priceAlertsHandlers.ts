import type { Request, Response } from 'express';
import type { PriceAlerts } from '../application/priceAlerts.js';

/** 로그인 필수 라우터(requireAuth) 뒤에 연결한다. */
export function createPriceAlertsHandlers(alerts: PriceAlerts) {
  return {
    /** POST /api/me/price-alerts/seen — 확인 처리 (헤더 알림 배지가 사라진다) */
    markSeen: async (req: Request, res: Response) => {
      try {
        await alerts.markSeen(req.user!.id);
        res.status(204).end();
      } catch {
        console.error('PRICE_ALERTS_SEEN_ERROR');
        res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '알림 확인 처리에 실패했습니다.' } });
      }
    },
  };
}

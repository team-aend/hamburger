import { getDbPool } from '../db/pool.js';
import { createPriceAlerts, type PriceAlerts } from './application/priceAlerts.js';
import { PgPriceAlerts } from './infrastructure/pgPriceAlerts.js';
import { createPriceAlertsHandlers } from './presentation/priceAlertsHandlers.js';

/**
 * 좋아요한 버거 가격 변동 알림.
 * - priceAlerts(): 다른 기능(마이페이지 좋아요 목록, 로그인 상태의 알림 수)이 쓰는 공개 유스케이스
 * - priceAlertsHandlers(): HTTP 핸들러
 * DB 는 호출 시점에 연결한다.
 */
export function priceAlerts(): PriceAlerts {
  return createPriceAlerts(new PgPriceAlerts(getDbPool()));
}

export function priceAlertsHandlers() {
  return createPriceAlertsHandlers(priceAlerts());
}

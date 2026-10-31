import { getDbPool } from '../db/pool.js';
import { createGetTasteReport } from './application/getTasteReport.js';
import { PgTaste } from './infrastructure/pgTaste.js';
import { createTasteHandler } from './presentation/tasteHandler.js';

/** 내 취향 리포트 (좋아요 · 월드컵 우승 · 높은 별점 기반). DB 는 요청 시점에 연결한다. */
export function tasteHandler() {
  return createTasteHandler((userId) => createGetTasteReport(new PgTaste(getDbPool()))(userId));
}

import { Router } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDbPool } from '../db/pool.js';
import { createSavedSearches } from './application/savedSearches.js';
import { PgSavedSearches } from './infrastructure/pgSavedSearches.js';
import { createSavedSearchHandlers } from './presentation/savedSearchHandlers.js';

/**
 * 저장한 검색 조건 (로그인 필수). DB 는 요청 시점에 연결한다.
 *   GET    /api/saved-searches                  내 조건 목록 (최근 순)
 *   POST   /api/saved-searches                  { name, filters } 저장 (최대 10개, 넘으면 409)
 *   DELETE /api/saved-searches/:savedSearchId   삭제 (본인 것만)
 */
export function createSavedSearchesRouter() {
  const router = Router();
  router.use(requireAuth);
  const handlers = () => createSavedSearchHandlers(createSavedSearches(new PgSavedSearches(getDbPool())));
  router.get('/', (req, res) => handlers().list(req, res));
  router.post('/', (req, res) => handlers().create(req, res));
  router.delete('/:savedSearchId', (req, res) => handlers().remove(req, res));
  return router;
}

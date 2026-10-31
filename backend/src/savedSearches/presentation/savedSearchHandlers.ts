import type { Request, Response } from 'express';
import type { SavedSearches } from '../application/savedSearches.js';
import { SavedSearchInvalid, SavedSearchLimitExceeded } from '../domain/savedSearch.js';

const ID = /^[1-9]\d{0,18}$/;

function fail(res: Response, error: unknown) {
  if (error instanceof SavedSearchInvalid) {
    res.status(400).json({ error: { code: 'INVALID_SAVED_SEARCH', message: error.message } });
  } else if (error instanceof SavedSearchLimitExceeded) {
    res.status(409).json({ error: { code: 'SAVED_SEARCH_LIMIT', message: error.message } });
  } else {
    console.error('SAVED_SEARCH_ERROR');
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: '검색 조건을 처리하지 못했습니다.' } });
  }
}

/** 로그인 필수 라우터(requireAuth) 뒤에 연결한다. */
export function createSavedSearchHandlers(savedSearches: SavedSearches) {
  return {
    list: async (req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      try { res.status(200).json({ items: await savedSearches.list(req.user!.id) }); } catch (error) { fail(res, error); }
    },
    create: async (req: Request, res: Response) => {
      try { res.status(201).json({ item: await savedSearches.create(req.user!.id, req.body) }); } catch (error) { fail(res, error); }
    },
    remove: async (req: Request, res: Response) => {
      const id = req.params.savedSearchId;
      if (typeof id !== 'string' || !ID.test(id)) {
        res.status(400).json({ error: { code: 'INVALID_ID', message: '검색 조건 번호를 확인해 주세요.' } });
        return;
      }
      try {
        if (await savedSearches.remove(req.user!.id, id)) res.status(204).end();
        else res.status(404).json({ error: { code: 'SAVED_SEARCH_NOT_FOUND', message: '삭제할 검색 조건이 없습니다.' } });
      } catch (error) { fail(res, error); }
    },
  };
}

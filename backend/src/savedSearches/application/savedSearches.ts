import {
  canSaveMore,
  parseSavedSearchInput,
  SavedSearchLimitExceeded,
  type SavedSearch,
  type SearchFilters,
} from '../domain/savedSearch.js';

export interface SavedSearchTransaction {
  /** 같은 회원의 동시 저장을 직렬화하고 현재 개수를 센다 */
  lockAndCount(userId: number): Promise<number>;
  insert(userId: number, name: string, filters: SearchFilters): Promise<SavedSearch>;
}

export interface SavedSearchRepository {
  list(userId: number): Promise<SavedSearch[]>;
  /** 본인 것만 지운다. 지웠으면 true */
  remove(userId: number, savedSearchId: string): Promise<boolean>;
  transaction<T>(work: (tx: SavedSearchTransaction) => Promise<T>): Promise<T>;
}

export function createSavedSearches(repository: SavedSearchRepository) {
  return {
    list: (userId: number) => repository.list(userId),
    /** 검증 → (잠금 + 개수 확인 → 저장) 을 한 트랜잭션으로. 실패하면 아무것도 저장하지 않는다. */
    create: async (userId: number, body: unknown): Promise<SavedSearch> => {
      const { name, filters } = parseSavedSearchInput(body);
      return repository.transaction(async (tx) => {
        if (!canSaveMore(await tx.lockAndCount(userId))) throw new SavedSearchLimitExceeded();
        return tx.insert(userId, name, filters);
      });
    },
    remove: (userId: number, savedSearchId: string) => repository.remove(userId, savedSearchId),
  };
}

export type SavedSearches = ReturnType<typeof createSavedSearches>;

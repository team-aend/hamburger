import type pg from 'pg';
import type { SavedSearchRepository, SavedSearchTransaction } from '../application/savedSearches.js';
import type { SavedSearch, SearchFilters } from '../domain/savedSearch.js';

const toSavedSearch = (row: { id: string; name: string; filters: SearchFilters; created_at: Date }): SavedSearch => ({
  savedSearchId: String(row.id),
  name: row.name,
  filters: row.filters,
  createdAt: new Date(row.created_at).toISOString(),
});

export class PgSavedSearches implements SavedSearchRepository {
  constructor(private pool: Pick<pg.Pool, 'query' | 'connect'>) {}

  async list(userId: number): Promise<SavedSearch[]> {
    const { rows } = await this.pool.query(
      'SELECT id::text AS id, name, filters, created_at FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC, id DESC',
      [userId],
    );
    return rows.map(toSavedSearch);
  }

  async remove(userId: number, savedSearchId: string): Promise<boolean> {
    const result = await this.pool.query(
      'DELETE FROM saved_searches WHERE id = $1::bigint AND user_id = $2',
      [savedSearchId, userId],
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** 한 연결에서 BEGIN/COMMIT, 실패하면 전체 ROLLBACK */
  async transaction<T>(work: (tx: SavedSearchTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await work({
        lockAndCount: async (userId) => {
          await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
          const { rows } = await client.query('SELECT COUNT(*)::int AS count FROM saved_searches WHERE user_id = $1', [userId]);
          return rows[0].count;
        },
        insert: async (userId, name, filters) => {
          const { rows } = await client.query(
            `INSERT INTO saved_searches (user_id, name, filters) VALUES ($1, $2, $3)
             RETURNING id::text AS id, name, filters, created_at`,
            [userId, name, JSON.stringify(filters)],
          );
          return toSavedSearch(rows[0]);
        },
      });
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

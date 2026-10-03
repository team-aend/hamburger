import type pg from 'pg';
import type { CreationRecord, StartWorldcupInput, WorldcupTransaction, WorldcupUnitOfWork } from '../application/ports.js';
import type { WorldcupSessionState, createInitialSession } from '../domain/session.js';
import { listEligibleProducts } from './pgProducts.js';
import { translateStorageError } from './storageErrors.js';

class PgWorldcupTransaction implements WorldcupTransaction {
  constructor(private client: pg.PoolClient) {}

  async reserveCreation(input: StartWorldcupInput, bodyHash: string, ttl: number): Promise<boolean> {
    const result = await this.client.query(
      `INSERT INTO worldcup_creation_requests
        (request_key, owner_token_hash, request_body_hash, created_at, retry_expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + make_interval(secs => $4))
       ON CONFLICT (request_key) DO NOTHING RETURNING request_key`,
      [input.requestKey, input.ownerHash, bodyHash, ttl],
    );
    return result.rows.length > 0;
  }

  async findCreation(requestKey: string): Promise<CreationRecord | undefined> {
    const result = await this.client.query<{
      owner_token_hash: string; request_body_hash: string; initial_response: WorldcupSessionState | null; expired: boolean;
    }>(
      `SELECT owner_token_hash, request_body_hash, initial_response,
              retry_expires_at <= NOW() AS expired
       FROM worldcup_creation_requests WHERE request_key = $1`, [requestKey],
    );
    const row = result.rows[0];
    return row && { ownerHash: row.owner_token_hash, bodyHash: row.request_body_hash, state: row.initial_response, expired: row.expired };
  }

  async lockOwner(ownerHash: string): Promise<void> {
    await this.client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [ownerHash]);
  }

  async recentCreationCount(ownerHash: string, windowSeconds: number) {
    const result = await this.client.query<{ count: string; retry_after: number }>(
      `SELECT COUNT(*) AS count,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (MIN(created_at) + make_interval(secs => $2) - clock_timestamp()))))::int AS retry_after
       FROM worldcup_sessions
       WHERE owner_token_hash = $1 AND created_at > clock_timestamp() - make_interval(secs => $2)`, [ownerHash, windowSeconds],
    );
    return { count: Number(result.rows[0].count), retryAfter: result.rows[0].retry_after };
  }

  listProducts() { return listEligibleProducts(this.client); }

  async expiration(ttl: number): Promise<string> {
    const result = await this.client.query<{ expires_at: Date }>(
      'SELECT clock_timestamp() + make_interval(secs => $1) AS expires_at', [ttl],
    );
    return result.rows[0].expires_at.toISOString();
  }

  async saveSession(ownerHash: string, session: ReturnType<typeof createInitialSession>): Promise<void> {
    const { state, entries, matches } = session;
    await this.client.query(
      `INSERT INTO worldcup_sessions
        (id, owner_token_hash, round_size, status, created_at, expires_at)
       VALUES ($1, $2, $3, 'IN_PROGRESS', clock_timestamp(), $4)`,
      [state.sessionId, ownerHash, state.roundSize, state.expiresAt],
    );
    for (const [position, entry] of entries.entries()) {
      await this.client.query(
        `INSERT INTO worldcup_entries
          (session_id, product_id, position, name, brand_name, description, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [state.sessionId, entry.productId, position, entry.name, entry.brandName, entry.description, entry.imageUrl],
      );
    }
    for (const match of matches) {
      await this.client.query(
        `INSERT INTO worldcup_session_matches
          (id, session_id, round_size, match_index, left_product_id, right_product_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [match.id, state.sessionId, state.roundSize, match.index, match.left.productId, match.right.productId],
      );
    }
  }

  async finishCreation(requestKey: string, state: WorldcupSessionState): Promise<void> {
    await this.client.query(
      `UPDATE worldcup_creation_requests SET session_id = $2, initial_response = $3::jsonb,
        retry_expires_at = GREATEST($4::timestamptz, clock_timestamp() + INTERVAL '24 hours')
       WHERE request_key = $1`, [requestKey, state.sessionId, JSON.stringify(state), state.expiresAt],
    );
  }
}

export class PgWorldcupUnitOfWork implements WorldcupUnitOfWork {
  constructor(private pool: Pick<pg.Pool, 'connect'>) {}

  async transaction<T>(work: (tx: WorldcupTransaction) => Promise<T>): Promise<T> {
    const client = await this.pool.connect().catch((error: unknown) => { throw translateStorageError(error); });
    let inTransaction = false;
    let discard = false;
    try {
      await client.query('BEGIN');
      inTransaction = true;
      const result = await work(new PgWorldcupTransaction(client));
      await client.query('COMMIT');
      inTransaction = false;
      return result;
    } catch (error) {
      if (inTransaction) {
        try { await client.query('ROLLBACK'); } catch { discard = true; }
      }
      throw translateStorageError(error);
    } finally {
      client.release(discard);
    }
  }
}

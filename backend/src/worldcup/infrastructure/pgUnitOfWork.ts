import type pg from 'pg';
import type { CreationRecord, StartWorldcupInput, WorldcupTransaction, WorldcupUnitOfWork } from '../application/ports.js';
import type { WorldcupSessionState, createInitialSession } from '../domain/session.js';
import { listEligibleProducts } from './pgProducts.js';
import { translateStorageError } from './storageErrors.js';
import type { PlayTransaction, PlayUnitOfWork } from '../application/playWorldcup.js';
import type { StoredSession, StoredMatch, SessionStatus } from '../domain/progression.js';
import type { RoundSize } from '../domain/session.js';

class PgWorldcupTransaction implements WorldcupTransaction, PlayTransaction {
  constructor(private client: pg.PoolClient) {}

  async loadSession(id: string, ownerHash: string, lock: boolean): Promise<StoredSession | undefined> {
    const result = await this.client.query<{
      id: string; round_size: RoundSize; status: SessionStatus; expires_at: Date;
      completed_at: Date | null; winner_product_id: string | null;
    }>(`SELECT id, round_size, status, expires_at, completed_at, winner_product_id
        FROM worldcup_sessions WHERE id=$1 AND owner_token_hash=$2 ${lock ? 'FOR UPDATE' : ''}`, [id, ownerHash]);
    const row = result.rows[0];
    if (!row) return undefined;
    const entries = await this.client.query(`SELECT product_id, name, brand_name, description, image_url
      FROM worldcup_entries WHERE session_id=$1 ORDER BY position`, [id]);
    const matches = await this.client.query(`SELECT id, round_size, match_index, left_product_id, right_product_id, winner_product_id
      FROM worldcup_session_matches WHERE session_id=$1 ORDER BY round_size DESC, match_index`, [id]);
    return {
      sessionId: row.id, roundSize: row.round_size, status: row.status, expiresAt: row.expires_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null, winnerId: row.winner_product_id,
      entries: entries.rows.map((entry) => ({ productId: entry.product_id, name: entry.name, brandName: entry.brand_name, description: entry.description, imageUrl: entry.image_url })),
      matches: matches.rows.map((match) => ({ id: match.id, roundSize: match.round_size, index: match.match_index, leftId: match.left_product_id, rightId: match.right_product_id, winnerId: match.winner_product_id })),
    };
  }

  async now(): Promise<string> {
    const result = await this.client.query<{ now: Date }>('SELECT clock_timestamp() AS now');
    return result.rows[0].now.toISOString();
  }

  async saveDecision(sessionId: string, matchId: string, winnerId: string, decidedAt: string, newMatches: StoredMatch[], completed: boolean): Promise<void> {
    await this.client.query('UPDATE worldcup_session_matches SET winner_product_id=$3, decided_at=$4 WHERE session_id=$1 AND id=$2',
      [sessionId, matchId, winnerId, decidedAt]);
    for (const match of newMatches) {
      await this.client.query(`INSERT INTO worldcup_session_matches
        (id, session_id, round_size, match_index, left_product_id, right_product_id) VALUES ($1,$2,$3,$4,$5,$6)`,
      [match.id, sessionId, match.roundSize, match.index, match.leftId, match.rightId]);
    }
    if (completed) await this.client.query("UPDATE worldcup_sessions SET status='COMPLETED', winner_product_id=$2, completed_at=$3 WHERE id=$1", [sessionId, winnerId, decidedAt]);
  }

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

export class PgWorldcupUnitOfWork implements WorldcupUnitOfWork, PlayUnitOfWork {
  constructor(private pool: Pick<pg.Pool, 'connect'>) {}

  async transaction<T>(work: (tx: WorldcupTransaction & PlayTransaction) => Promise<T>, options?: { readOnly?: boolean }): Promise<T> {
    const client = await this.pool.connect().catch((error: unknown) => { throw translateStorageError(error); });
    let inTransaction = false;
    let discard = false;
    try {
      await client.query(options?.readOnly ? 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY' : 'BEGIN');
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

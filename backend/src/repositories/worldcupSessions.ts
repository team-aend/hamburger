import type pg from 'pg';
import { getDbPool } from '../db/pool.js';
import { listEligibleProducts } from './worldcupProducts.js';
import {
  hashStartBody,
  prepareWorldcup,
  sessionLifetimeSeconds,
  WorldcupSessionError,
  type StartWorldcupInput,
  type WorldcupSessionResponse,
} from '../services/worldcupSession.js';

export interface StartWorldcupResult {
  replayed: boolean;
  response: WorldcupSessionResponse;
}

export async function createWorldcupSession(
  input: StartWorldcupInput,
  pool: Pick<pg.Pool, 'connect'> = getDbPool(),
): Promise<StartWorldcupResult> {
  const ttl = sessionLifetimeSeconds();
  const client = await pool.connect();
  let inTransaction = false;
  try {
    await client.query('BEGIN');
    inTransaction = true;
    const bodyHash = hashStartBody(input.roundSize);
    const reservation = await client.query(
      `INSERT INTO worldcup_creation_requests
        (request_key, owner_token_hash, request_body_hash, created_at, retry_expires_at)
       VALUES ($1, $2, $3, NOW(), NOW() + make_interval(secs => $4))
       ON CONFLICT (request_key) DO NOTHING RETURNING request_key`,
      [input.requestKey, input.ownerHash, bodyHash, Math.max(ttl, 86400)],
    );

    if (reservation.rows.length === 0) {
      const existing = await client.query<{
        owner_token_hash: string; request_body_hash: string;
        initial_response: WorldcupSessionResponse; expired: boolean;
      }>(
        `SELECT owner_token_hash, request_body_hash, initial_response,
                retry_expires_at <= NOW() AS expired
         FROM worldcup_creation_requests WHERE request_key = $1`,
        [input.requestKey],
      );
      const record = existing.rows[0];
      if (!record) throw new Error('Missing creation request');
      if (record.owner_token_hash !== input.ownerHash || record.request_body_hash !== bodyHash) {
        throw new WorldcupSessionError(409, 'IDEMPOTENCY_KEY_REUSED', '이미 다른 요청에 사용된 요청 키입니다.');
      }
      if (record.expired) {
        throw new WorldcupSessionError(409, 'IDEMPOTENCY_KEY_EXPIRED', '재시도 기한이 지난 요청 키입니다.');
      }
      if (!record.initial_response) throw new Error('Incomplete creation request');
      await client.query('COMMIT');
      inTransaction = false;
      return { replayed: true, response: record.initial_response };
    }

    // Serialize creation limits for an owner, including requests with different keys.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [input.ownerHash]);
    const rate = await client.query<{ count: string; retry_after: number }>(
      `SELECT COUNT(*) AS count,
              GREATEST(1, CEIL(EXTRACT(EPOCH FROM (MIN(created_at) + INTERVAL '60 seconds' - clock_timestamp()))))::int AS retry_after
       FROM worldcup_sessions
       WHERE owner_token_hash = $1 AND created_at > clock_timestamp() - INTERVAL '60 seconds'`,
      [input.ownerHash],
    );
    if (Number(rate.rows[0].count) >= 5) {
      throw new WorldcupSessionError(429, 'WORLD_CUP_RATE_LIMITED', '잠시 후 새 월드컵을 시작해 주세요.', rate.rows[0].retry_after);
    }

    const products = await listEligibleProducts(client);
    const timing = await client.query<{ expires_at: Date }>(
      "SELECT clock_timestamp() + make_interval(secs => $1) AS expires_at", [ttl],
    );
    const { response, entries, matches } = prepareWorldcup(products, input.roundSize, timing.rows[0].expires_at.toISOString());
    await client.query(
      `INSERT INTO worldcup_sessions
        (id, owner_token_hash, round_size, status, created_at, expires_at)
       VALUES ($1, $2, $3, 'IN_PROGRESS', clock_timestamp(), $4)`,
      [response.sessionId, input.ownerHash, input.roundSize, response.expiresAt],
    );
    for (const [position, entry] of entries.entries()) {
      await client.query(
        `INSERT INTO worldcup_entries
          (session_id, product_id, position, name, brand_name, description, image_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [response.sessionId, entry.productId, position, entry.name, entry.brandName, entry.description, entry.imageUrl],
      );
    }
    for (const match of matches) {
      await client.query(
        `INSERT INTO worldcup_session_matches
          (id, session_id, round_size, match_index, left_product_id, right_product_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [match.id, response.sessionId, input.roundSize, match.index, match.left.productId, match.right.productId],
      );
    }
    await client.query(
      `UPDATE worldcup_creation_requests SET session_id = $2, initial_response = $3::jsonb,
        retry_expires_at = GREATEST($4::timestamptz, clock_timestamp() + INTERVAL '24 hours')
       WHERE request_key = $1`,
      [input.requestKey, response.sessionId, JSON.stringify(response), response.expiresAt],
    );
    await client.query('COMMIT');
    inTransaction = false;
    return { replayed: false, response };
  } catch (error) {
    if (inTransaction) {
      try { await client.query('ROLLBACK'); } catch { /* Preserve the original failure. */ }
    }
    throw error;
  } finally {
    client.release();
  }
}

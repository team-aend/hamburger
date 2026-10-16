import type pg from 'pg';
import type { CompletedSessionRecord, WorldcupShareRepository } from '../application/getShare.js';
import { translateStorageError } from './storageErrors.js';

/** 세션에 저장된 참가 당시의 상품 정보(worldcup_entries)를 쓴다. 이후 상품명이 바뀌어도 결과는 그대로다. */
export class PgWorldcupShare implements WorldcupShareRepository {
  constructor(private db: Pick<pg.Pool, 'query'>) {}

  async findCompleted(sessionId: string): Promise<CompletedSessionRecord | null> {
    try {
      const { rows } = await this.db.query(`
        WITH s AS (
          SELECT id, round_size, completed_at, winner_product_id FROM worldcup_sessions
          WHERE id = $1::uuid AND status = 'COMPLETED'
        ), entry AS (
          SELECT e.product_id, jsonb_build_object(
            'productId', e.product_id::text, 'name', e.name, 'brandName', e.brand_name,
            'description', e.description, 'imageUrl', e.image_url) AS product
          FROM worldcup_entries e JOIN s ON s.id = e.session_id
        )
        SELECT s.id::text AS session_id, s.round_size, s.completed_at,
          (SELECT product FROM entry WHERE product_id = s.winner_product_id) AS winner,
          COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'roundSize', m.round_size, 'left', l.product, 'right', r.product,
              'winnerProductId', m.winner_product_id::text) ORDER BY m.round_size DESC, m.match_index)
            FROM worldcup_session_matches m
            JOIN entry l ON l.product_id = m.left_product_id
            JOIN entry r ON r.product_id = m.right_product_id
            WHERE m.session_id = s.id AND m.winner_product_id IS NOT NULL), '[]'::jsonb) AS matches
        FROM s
      `, [sessionId]);
      const row = rows[0];
      if (!row || !row.winner) return null;
      return {
        sessionId: row.session_id,
        roundSize: Number(row.round_size) as 8 | 16,
        completedAt: new Date(row.completed_at).toISOString(),
        winner: row.winner,
        matches: row.matches,
      };
    } catch (error) {
      throw translateStorageError(error);
    }
  }
}

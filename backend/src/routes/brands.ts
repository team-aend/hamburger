import { Router, Request, Response } from 'express';
import { getDbPool } from '../db/pool.js';

const router = Router();

/**
 * GET /api/brands
 * Supabase brands 테이블에서 브랜드 기본 데이터를 직접 조회하여 반환
 * ?includeInactive=true 전달 시 비활성(is_active=false) 브랜드까지 모두 조회
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const pool = getDbPool();

    const queryText = includeInactive
      ? `SELECT id, name, slug, logo_url, homepage_url, is_active, created_at, updated_at
         FROM brands
         ORDER BY id ASC`
      : `SELECT id, name, slug, logo_url, homepage_url, is_active, created_at, updated_at
         FROM brands
         WHERE is_active = TRUE
         ORDER BY id ASC`;

    const result = await pool.query(queryText);

    const items = result.rows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      slug: row.slug,
      logoUrl: row.logo_url ?? null,
      homepageUrl: row.homepage_url ?? null,
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));

    res.status(200).json({
      source: 'supabase',
      totalCount: items.length,
      brands: items,
    });
  } catch (error) {
    console.error('❌ Supabase brands 테이블 조회 오류:', error);
    res.status(500).json({
      message: 'Supabase brands 테이블 데이터를 가져오는 중 오류가 발생했습니다.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

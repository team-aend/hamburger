import { Router, Request, Response } from 'express';
import { getCachedDataset } from '../db/datasetCache.js';

const router = Router();

/**
 * GET /api/brands
 * Node.js 인메모리 캐시(Supabase 연동)에서 브랜드 기본 데이터를 반환
 * - ?refresh=true 전달 시 캐시를 즉시 무효화하고 Supabase DB에서 새로 조회
 * - ?includeInactive=true 전달 시 비활성(is_active=false) 브랜드까지 모두 반환
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const forceRefresh = req.query.refresh === 'true';

    const { dataset, cacheHit } = await getCachedDataset({ forceRefresh });
    const items = (
      includeInactive
        ? dataset.brands
        : dataset.brands.filter((b) => b.isActive)
    ).map((brand) => ({
      id: brand.id,
      name: brand.name,
      slug: brand.slug,
      logoUrl: brand.logoUrl ?? null,
      homepageUrl: brand.homepageUrl ?? null,
      isActive: brand.isActive,
    }));

    res.status(200).json({
      source: dataset.source,
      cache: {
        hit: cacheHit,
        cachedAt: dataset.cachedAt,
      },
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

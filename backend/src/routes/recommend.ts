import { Router, Request, Response } from 'express';
import {
  getCachedDataset,
  type CachedDataset,
} from '../db/datasetCache.js';

const router = Router();

/**
 * 필터 메타데이터 객체 빌더 (프론트엔드 초기 진입 시 /api/recommend?includeFilters=true 와 /api/recommend/filters 공통 사용)
 */
function buildFiltersPayload(dataset: CachedDataset) {
  return {
    dataSource: dataset.source,
    brands: dataset.brands.filter((b) => b.isActive),
    allBrands: dataset.brands,
    ingredients: dataset.ingredients,
    tags: dataset.tags,
    calorieRange: {
      min: 350,
      max: 1200,
      step: 50,
    },
    priceRange: {
      min: 4000,
      max: 12000,
      step: 500,
    },
  };
}

/**
 * 공통 필터링 헬퍼 함수 (Node.js 인메모리 캐시에서 미리 Join된 baseEnrichedProducts를 사용해 < 1ms 내 필터링)
 */
async function getFilteredProducts(query: Request['query']) {
  const forceRefresh = query.refresh === 'true';
  const { dataset, cacheHit } = await getCachedDataset({ forceRefresh });

  const {
    keyword: keywordParam,
    brands: brandParam,
    includeIngredients: includeParam,
    excludeIngredients: excludeParam,
    minPrice: minPriceParam,
    maxPrice: maxPriceParam,
    priceChannel: priceChannelParam,
    maxCalories: maxCalParam,
    variantType: variantTypeParam,
    sortBy: sortByParam,
  } = query;

  const keyword =
    typeof keywordParam === 'string' ? keywordParam.trim().toLowerCase() : '';

  const selectedBrandSlugs =
    typeof brandParam === 'string' && brandParam.trim().length > 0
      ? brandParam.split(',').map((s) => s.trim())
      : [];

  const includeSlugs =
    typeof includeParam === 'string' && includeParam.trim().length > 0
      ? includeParam.split(',').map((s) => s.trim())
      : [];

  const excludeSlugs =
    typeof excludeParam === 'string' && excludeParam.trim().length > 0
      ? excludeParam.split(',').map((s) => s.trim())
      : [];

  const minPrice =
    typeof minPriceParam === 'string' && minPriceParam.trim().length > 0
      ? Number(minPriceParam)
      : null;

  const maxPrice =
    typeof maxPriceParam === 'string' && maxPriceParam.trim().length > 0
      ? Number(maxPriceParam)
      : null;

  const targetPriceChannel: 'STORE' | 'DELIVERY' =
    priceChannelParam === 'DELIVERY' ? 'DELIVERY' : 'STORE';

  const maxCalories =
    typeof maxCalParam === 'string' && maxCalParam.trim().length > 0
      ? Number(maxCalParam)
      : null;

  const targetVariantType: 'SINGLE' | 'SET' =
    variantTypeParam === 'SET' ? 'SET' : 'SINGLE';

  const sortBy =
    typeof sortByParam === 'string' ? sortByParam : 'calories_asc';

  const enrichedProducts = dataset.baseEnrichedProducts.map((product) => {
    const activeVariant =
      product.variants.find((v) => v.variantType === targetVariantType) ||
      product.variants.find((v) => v.isDefault) ||
      product.variants[0];

    return {
      ...product,
      activeVariant,
    };
  });

  const filtered = enrichedProducts.filter((item) => {
    if (!item.activeVariant) return false;

    if (keyword.length > 0) {
      const matchedName = item.name.toLowerCase().includes(keyword);
      const matchedBrand = item.brand.name.toLowerCase().includes(keyword);
      if (!matchedName && !matchedBrand) {
        return false;
      }
    }

    if (
      selectedBrandSlugs.length > 0 &&
      !selectedBrandSlugs.includes(item.brand.slug)
    ) {
      return false;
    }

    if (includeSlugs.length > 0) {
      const hasAllIncluded = includeSlugs.every((slug) =>
        item.ingredientSlugs.includes(slug)
      );
      if (!hasAllIncluded) {
        return false;
      }
    }

    if (excludeSlugs.length > 0) {
      const hasAnyExcluded = excludeSlugs.some((slug) =>
        item.ingredientSlugs.includes(slug)
      );
      if (hasAnyExcluded) {
        return false;
      }
    }

    const itemPrice =
      targetPriceChannel === 'DELIVERY'
        ? item.activeVariant.prices.delivery
        : item.activeVariant.prices.store;

    if (
      minPrice !== null &&
      !Number.isNaN(minPrice) &&
      itemPrice < minPrice
    ) {
      return false;
    }

    if (
      maxPrice !== null &&
      !Number.isNaN(maxPrice) &&
      itemPrice > maxPrice
    ) {
      return false;
    }

    if (
      maxCalories !== null &&
      !Number.isNaN(maxCalories) &&
      item.activeVariant.nutrition.caloriesKcal > maxCalories
    ) {
      return false;
    }

    return true;
  });

  filtered.sort((a, b) => {
    const getPrice = (entry: (typeof filtered)[number]) =>
      targetPriceChannel === 'DELIVERY'
        ? entry.activeVariant.prices.delivery
        : entry.activeVariant.prices.store;

    if (sortBy === 'calories_desc') {
      return (
        b.activeVariant.nutrition.caloriesKcal -
        a.activeVariant.nutrition.caloriesKcal
      );
    }
    if (sortBy === 'price_asc') {
      return getPrice(a) - getPrice(b);
    }
    if (sortBy === 'price_desc') {
      return getPrice(b) - getPrice(a);
    }
    if (sortBy === 'protein_desc') {
      return (
        b.activeVariant.nutrition.proteinG - a.activeVariant.nutrition.proteinG
      );
    }
    return (
      a.activeVariant.nutrition.caloriesKcal -
      b.activeVariant.nutrition.caloriesKcal
    );
  });

  return {
    dataset,
    cacheHit,
    dataSource: dataset.source,
    filtered,
    appliedFilters: {
      brands: selectedBrandSlugs,
      includeIngredients: includeSlugs,
      excludeIngredients: excludeSlugs,
      minPrice,
      maxPrice,
      priceChannel: targetPriceChannel,
      maxCalories,
      variantType: targetVariantType,
      sortBy,
    },
  };
}

router.get('/filters', async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === 'true';
    const { dataset, cacheHit } = await getCachedDataset({ forceRefresh });
    res.status(200).json({
      ...buildFiltersPayload(dataset),
      cache: {
        hit: cacheHit,
        cachedAt: dataset.cachedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error ? error.message : 'DB 조회 오류가 발생했습니다.',
    });
  }
});

router.get('/random', async (req: Request, res: Response) => {
  try {
    const { dataset, cacheHit, dataSource, filtered, appliedFilters } =
      await getFilteredProducts(req.query);
    const excludeProductId =
      typeof req.query.excludeProductId === 'string'
        ? Number(req.query.excludeProductId)
        : null;

    if (filtered.length === 0) {
      res.status(200).json({
        dataSource,
        cache: {
          hit: cacheHit,
          cachedAt: dataset.cachedAt,
        },
        totalCandidates: 0,
        picked: null,
        appliedFilters,
      });
      return;
    }

    let candidatePool = filtered;
    if (excludeProductId !== null && filtered.length > 1) {
      const withoutPrev = filtered.filter(
        (item) => item.id !== excludeProductId
      );
      if (withoutPrev.length > 0) {
        candidatePool = withoutPrev;
      }
    }

    const randomIndex = Math.floor(Math.random() * candidatePool.length);
    const picked = candidatePool[randomIndex];

    res.status(200).json({
      dataSource,
      cache: {
        hit: cacheHit,
        cachedAt: dataset.cachedAt,
      },
      totalCandidates: filtered.length,
      picked,
      appliedFilters,
    });
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error ? error.message : 'DB 조회 오류가 발생했습니다.',
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const includeFilters = req.query.includeFilters === 'true';
    const { dataset, cacheHit, dataSource, filtered, appliedFilters } =
      await getFilteredProducts(req.query);

    res.status(200).json({
      dataSource,
      cache: {
        hit: cacheHit,
        cachedAt: dataset.cachedAt,
      },
      totalCount: filtered.length,
      appliedFilters,
      items: filtered,
      ...(includeFilters ? { filters: buildFiltersPayload(dataset) } : {}),
    });
  } catch (error) {
    res.status(500).json({
      message:
        error instanceof Error ? error.message : 'DB 조회 오류가 발생했습니다.',
    });
  }
});

export default router;

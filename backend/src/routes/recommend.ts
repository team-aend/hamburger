import { Router, Request, Response } from 'express';
import {
  brands,
  categories,
  ingredients,
  nutritions,
  productIngredients,
  productPrices,
  products,
  productTags,
  productVariants,
  tags,
} from '../data/database.js';

const router = Router();

/**
 * 공통 필터링 헬퍼 함수
 * GET /api/recommend 및 GET /api/recommend/random 에서 동일하게 사용
 */
function getFilteredProducts(query: Request['query']) {
  const {
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

  // Product -> Brand, Category, Ingredients, Variants(SINGLE/SET) -> Prices, Nutrition 조인
  const enrichedProducts = products
    .filter((p) => p.status === 'ACTIVE')
    .map((product) => {
      const brand = brands.find((b) => b.id === product.brandId)!;
      const category = categories.find((c) => c.id === product.categoryId)!;

      // 상품의 재료 목록
      const prodIngRows = productIngredients
        .filter((pi) => pi.productId === product.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const prodIngredients = prodIngRows
        .map((pi) => ingredients.find((i) => i.id === pi.ingredientId))
        .filter((i): i is NonNullable<typeof i> => Boolean(i));

      // 상품의 태그 목록
      const prodTagRows = productTags.filter((pt) => pt.productId === product.id);
      const prodTags = prodTagRows
        .map((pt) => tags.find((t) => t.id === pt.tagId))
        .filter((t): t is NonNullable<typeof t> => Boolean(t));

      // 상품의 Variant(단품/세트) 및 가격/영양성분
      const variants = productVariants
        .filter((v) => v.productId === product.id && v.isActive)
        .map((v) => {
          const activePrices = productPrices.filter(
            (pp) => pp.productVariantId === v.id && pp.endedAt === null
          );
          const storePrice =
            activePrices.find((pp) => pp.channel === 'STORE')?.price ?? 0;
          const deliveryPrice =
            activePrices.find((pp) => pp.channel === 'DELIVERY')?.price ?? 0;
          const nutrition = nutritions.find(
            (n) => n.productVariantId === v.id
          )!;

          return {
            id: v.id,
            name: v.name,
            variantType: v.variantType,
            isDefault: v.isDefault,
            prices: {
              store: storePrice,
              delivery: deliveryPrice,
            },
            nutrition,
          };
        });

      const activeVariant =
        variants.find((v) => v.variantType === targetVariantType) ||
        variants.find((v) => v.isDefault) ||
        variants[0];

      return {
        ...product,
        brand,
        category,
        ingredients: prodIngredients,
        tags: prodTags,
        variants,
        activeVariant,
      };
    });

  // 필터링 적용
  const filtered = enrichedProducts.filter((item) => {
    // 1. 브랜드 필터
    if (
      selectedBrandSlugs.length > 0 &&
      !selectedBrandSlugs.includes(item.brand.slug)
    ) {
      return false;
    }

    const itemIngredientSlugs = item.ingredients.map((i) => i.slug);

    // 2. 포함할 재료(Include) 필터 — 선택한 포함 재료가 모두 들어있는지 확인
    if (includeSlugs.length > 0) {
      const hasAllIncluded = includeSlugs.every((slug) =>
        itemIngredientSlugs.includes(slug)
      );
      if (!hasAllIncluded) {
        return false;
      }
    }

    // 3. 제외할 재료(Exclude, "OO 빼고") 필터 — 선택한 제외 재료가 하나라도 들어있으면 제외
    if (excludeSlugs.length > 0) {
      const hasAnyExcluded = excludeSlugs.some((slug) =>
        itemIngredientSlugs.includes(slug)
      );
      if (hasAnyExcluded) {
        return false;
      }
    }

    // 4. 금액(minPrice ~ maxPrice) 범위 필터 — 선택된 판매형태(단품/세트) 및 채널(매장/배달) 기준
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

    // 5. 칼로리(Calories) 필터 — 선택된 판매형태(단품/세트)의 칼로리 기준
    if (
      maxCalories !== null &&
      !Number.isNaN(maxCalories) &&
      item.activeVariant.nutrition.caloriesKcal > maxCalories
    ) {
      return false;
    }

    return true;
  });

  // 정렬 적용
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
    // 기본: 칼로리 낮은 순 (calories_asc)
    return (
      a.activeVariant.nutrition.caloriesKcal -
      b.activeVariant.nutrition.caloriesKcal
    );
  });

  return {
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

/**
 * GET /api/recommend/filters
 * 추천 조건 선택에 필요한 브랜드, 재료(패티/토핑/치즈·소스), 태그, 칼로리/가격 범위 메타데이터 반환
 */
router.get('/filters', (_req: Request, res: Response) => {
  res.status(200).json({
    brands: brands.filter((b) => b.isActive),
    ingredients,
    tags,
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
  });
});

/**
 * GET /api/recommend/random
 * 현재 선택된 조건(조건이 없으면 전체 메뉴)에 해당하는 후보 중에서 랜덤으로 1개 추출
 * excludeProductId가 전달되고 후보가 2개 이상이면 직전 당첨 메뉴를 제외하고 새로운 메뉴를 뽑음
 */
router.get('/random', (req: Request, res: Response) => {
  const { filtered, appliedFilters } = getFilteredProducts(req.query);
  const excludeProductId =
    typeof req.query.excludeProductId === 'string'
      ? Number(req.query.excludeProductId)
      : null;

  if (filtered.length === 0) {
    res.status(200).json({
      totalCandidates: 0,
      picked: null,
      appliedFilters,
    });
    return;
  }

  let candidatePool = filtered;
  if (excludeProductId !== null && filtered.length > 1) {
    const withoutPrev = filtered.filter((item) => item.id !== excludeProductId);
    if (withoutPrev.length > 0) {
      candidatePool = withoutPrev;
    }
  }

  const randomIndex = Math.floor(Math.random() * candidatePool.length);
  const picked = candidatePool[randomIndex];

  res.status(200).json({
    totalCandidates: filtered.length,
    picked,
    appliedFilters,
  });
});

/**
 * GET /api/recommend
 * 조건(브랜드, 포함할 재료, 제외할 재료, 최소~최대 금액, 최대 칼로리, 단품/세트 기준, 정렬)에 맞는 햄버거 목록 조회
 */
router.get('/', (req: Request, res: Response) => {
  const { filtered, appliedFilters } = getFilteredProducts(req.query);

  res.status(200).json({
    totalCount: filtered.length,
    appliedFilters,
    items: filtered,
  });
});

export default router;

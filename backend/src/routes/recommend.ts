import { Router, Request, Response } from 'express';
import { getDbPool, isDbConfigured } from '../db/pool.js';
import {
  brands as seedBrands,
  categories as seedCategories,
  ingredients as seedIngredients,
  nutritions as seedNutritions,
  productIngredients as seedProductIngredients,
  productPrices as seedProductPrices,
  products as seedProducts,
  productTags as seedProductTags,
  productVariants as seedProductVariants,
  tags as seedTags,
  type Brand,
  type Category,
  type Ingredient,
  type Nutrition,
  type Product,
  type ProductIngredient,
  type ProductPrice,
  type ProductTag,
  type ProductVariant,
  type Tag,
} from '../data/database.js';

const router = Router();

/**
 * Supabase DB에서 브랜드(brands) 테이블은 항상 최우선으로 직접 조회하고,
 * 나머지 상품/영양성분 테이블도 DB에 데이터가 있으면 DB 값을, 비어있으면 시드 데이터를 사용
 */
async function loadDataset() {
  if (!isDbConfigured()) {
    return {
      source: 'memory' as const,
      brands: seedBrands,
      categories: seedCategories,
      ingredients: seedIngredients,
      tags: seedTags,
      products: seedProducts,
      productVariants: seedProductVariants,
      productPrices: seedProductPrices,
      nutritions: seedNutritions,
      productIngredients: seedProductIngredients,
      productTags: seedProductTags,
    };
  }

  const pool = getDbPool();

  // 1. brands 테이블은 사용자가 직접 넣은 Supabase DB 데이터를 단독으로 먼저 가져옴
  let dbBrands: Brand[] = [];
  try {
    const brandsRes = await pool.query(
      `SELECT id, name, slug, logo_url, homepage_url, is_active
       FROM brands
       ORDER BY id ASC`
    );
    if (brandsRes.rows.length > 0) {
      dbBrands = brandsRes.rows.map((r) => ({
        id: Number(r.id),
        name: r.name,
        slug: r.slug,
        logoUrl: r.logo_url ?? undefined,
        homepageUrl: r.homepage_url ?? undefined,
        isActive: r.is_active !== false,
      }));
    }
  } catch (err) {
    console.warn('⚠️ Supabase brands 테이블 단독 조회 오류:', err);
  }

  try {
    const [
      categoriesRes,
      ingredientsRes,
      tagsRes,
      productsRes,
      variantsRes,
      pricesRes,
      nutritionRes,
      prodIngRes,
      prodTagsRes,
    ] = await Promise.all([
      pool.query('SELECT id, name, slug FROM categories ORDER BY id'),
      pool.query(
        'SELECT id, name, slug, ingredient_group FROM ingredients ORDER BY id'
      ),
      pool.query('SELECT id, name, slug FROM tags ORDER BY id'),
      pool.query(
        'SELECT id, brand_id, category_id, name, slug, description, status, is_limited FROM products ORDER BY id'
      ),
      pool.query(
        'SELECT id, product_id, name, variant_type, is_default, is_active FROM product_variants ORDER BY id'
      ),
      pool.query(
        'SELECT id, product_variant_id, price, channel, started_at, ended_at FROM product_prices WHERE ended_at IS NULL ORDER BY id'
      ),
      pool.query(
        'SELECT id, product_variant_id, serving_size_g, calories_kcal, protein_g, sugar_g, saturated_fat_g, sodium_mg FROM nutrition ORDER BY id'
      ),
      pool.query(
        'SELECT product_id, ingredient_id, sort_order FROM product_ingredients ORDER BY product_id, sort_order'
      ),
      pool.query('SELECT product_id, tag_id FROM product_tags'),
    ]);

    const brands = dbBrands.length > 0 ? dbBrands : seedBrands;

    const categories: Category[] =
      categoriesRes.rows.length > 0
        ? categoriesRes.rows.map((r) => ({
            id: Number(r.id),
            name: r.name,
            slug: r.slug,
          }))
        : seedCategories;

    const ingredients: Ingredient[] =
      ingredientsRes.rows.length > 0
        ? ingredientsRes.rows.map((r) => ({
            id: Number(r.id),
            name: r.name,
            slug: r.slug,
            group: r.ingredient_group,
          }))
        : seedIngredients;

    const tags: Tag[] =
      tagsRes.rows.length > 0
        ? tagsRes.rows.map((r) => ({
            id: Number(r.id),
            name: r.name,
            slug: r.slug,
          }))
        : seedTags;

    const products: Product[] =
      productsRes.rows.length > 0
        ? productsRes.rows.map((r) => ({
            id: Number(r.id),
            brandId: Number(r.brand_id),
            categoryId: Number(r.category_id),
            name: r.name,
            slug: r.slug,
            description: r.description ?? '',
            status: r.status,
            isLimited: Boolean(r.is_limited),
          }))
        : seedProducts;

    const productVariants: ProductVariant[] =
      variantsRes.rows.length > 0
        ? variantsRes.rows.map((r) => ({
            id: Number(r.id),
            productId: Number(r.product_id),
            name: r.name,
            variantType: r.variant_type,
            isDefault: Boolean(r.is_default),
            isActive: Boolean(r.is_active),
          }))
        : seedProductVariants;

    const productPrices: ProductPrice[] =
      pricesRes.rows.length > 0
        ? pricesRes.rows.map((r) => ({
            id: Number(r.id),
            productVariantId: Number(r.product_variant_id),
            price: Number(r.price),
            channel: r.channel,
            startedAt: String(r.started_at),
            endedAt: r.ended_at ? String(r.ended_at) : null,
          }))
        : seedProductPrices;

    const nutritions: Nutrition[] =
      nutritionRes.rows.length > 0
        ? nutritionRes.rows.map((r) => ({
            id: Number(r.id),
            productVariantId: Number(r.product_variant_id),
            servingSizeG: Number(r.serving_size_g ?? 0),
            caloriesKcal: Number(r.calories_kcal ?? 0),
            proteinG: Number(r.protein_g ?? 0),
            sugarG: Number(r.sugar_g ?? 0),
            saturatedFatG: Number(r.saturated_fat_g ?? 0),
            sodiumMg: Number(r.sodium_mg ?? 0),
          }))
        : seedNutritions;

    const productIngredients: ProductIngredient[] =
      prodIngRes.rows.length > 0
        ? prodIngRes.rows.map((r) => ({
            productId: Number(r.product_id),
            ingredientId: Number(r.ingredient_id),
            sortOrder: Number(r.sort_order ?? 0),
          }))
        : seedProductIngredients;

    const productTags: ProductTag[] =
      prodTagsRes.rows.length > 0
        ? prodTagsRes.rows.map((r) => ({
            productId: Number(r.product_id),
            tagId: Number(r.tag_id),
          }))
        : seedProductTags;

    return {
      source: 'supabase' as const,
      brands,
      categories,
      ingredients,
      tags,
      products,
      productVariants,
      productPrices,
      nutritions,
      productIngredients,
      productTags,
    };
  } catch (err) {
    console.warn(
      '⚠️ 일부 테이블 조회 실패, brands는 Supabase DB 값을 유지하고 나머지는 시드를 사용합니다:',
      err
    );
    return {
      source: dbBrands.length > 0 ? ('supabase' as const) : ('memory' as const),
      brands: dbBrands.length > 0 ? dbBrands : seedBrands,
      categories: seedCategories,
      ingredients: seedIngredients,
      tags: seedTags,
      products: seedProducts,
      productVariants: seedProductVariants,
      productPrices: seedProductPrices,
      nutritions: seedNutritions,
      productIngredients: seedProductIngredients,
      productTags: seedProductTags,
    };
  }
}

/**
 * 공통 필터링 헬퍼 함수
 */
async function getFilteredProducts(query: Request['query']) {
  const {
    source,
    brands,
    categories,
    ingredients,
    tags,
    products,
    productVariants,
    productPrices,
    nutritions,
    productIngredients,
    productTags,
  } = await loadDataset();

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

  const enrichedProducts = products
    .filter((p) => p.status === 'ACTIVE')
    .map((product) => {
      // ID로 먼저 매칭하고, 만약 brands 테이블이 재생성되어 ID가 달라진 경우 시드 브랜드의 slug로 안전하게 매칭
      const seedBrandSlug = seedBrands.find((sb) => sb.id === product.brandId)?.slug;
      const brand =
        brands.find((b) => b.id === product.brandId) ||
        (seedBrandSlug ? brands.find((b) => b.slug === seedBrandSlug) : undefined) ||
        seedBrands.find((sb) => sb.id === product.brandId) || {
          id: product.brandId,
          name: '기타 브랜드',
          slug: 'other',
          isActive: true,
        };

      const category =
        categories.find((c) => c.id === product.categoryId) || seedCategories[0];

      const prodIngRows = productIngredients
        .filter((pi) => pi.productId === product.id)
        .sort((a, b) => a.sortOrder - b.sortOrder);
      const prodIngredients = prodIngRows
        .map((pi) => ingredients.find((i) => i.id === pi.ingredientId))
        .filter((i): i is NonNullable<typeof i> => Boolean(i));

      const prodTagRows = productTags.filter((pt) => pt.productId === product.id);
      const prodTags = prodTagRows
        .map((pt) => tags.find((t) => t.id === pt.tagId))
        .filter((t): t is NonNullable<typeof t> => Boolean(t));

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

  const filtered = enrichedProducts.filter((item) => {
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

    const itemIngredientSlugs = item.ingredients.map((i) => i.slug);

    if (includeSlugs.length > 0) {
      const hasAllIncluded = includeSlugs.every((slug) =>
        itemIngredientSlugs.includes(slug)
      );
      if (!hasAllIncluded) {
        return false;
      }
    }

    if (excludeSlugs.length > 0) {
      const hasAnyExcluded = excludeSlugs.some((slug) =>
        itemIngredientSlugs.includes(slug)
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
    dataSource: source,
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

router.get('/filters', async (_req: Request, res: Response) => {
  const { source, brands, ingredients, tags } = await loadDataset();
  res.status(200).json({
    dataSource: source,
    brands: brands.filter((b) => b.isActive),
    allBrands: brands,
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

router.get('/random', async (req: Request, res: Response) => {
  const { dataSource, filtered, appliedFilters } = await getFilteredProducts(
    req.query
  );
  const excludeProductId =
    typeof req.query.excludeProductId === 'string'
      ? Number(req.query.excludeProductId)
      : null;

  if (filtered.length === 0) {
    res.status(200).json({
      dataSource,
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
    dataSource,
    totalCandidates: filtered.length,
    picked,
    appliedFilters,
  });
});

router.get('/', async (req: Request, res: Response) => {
  const { dataSource, filtered, appliedFilters } = await getFilteredProducts(
    req.query
  );

  res.status(200).json({
    dataSource,
    totalCount: filtered.length,
    appliedFilters,
    items: filtered,
  });
});

export default router;

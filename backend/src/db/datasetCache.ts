import { getDbPool } from './pool.js';
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

export interface EnrichedVariant {
  id: number;
  name: string;
  variantType: 'SINGLE' | 'SET';
  isDefault: boolean;
  prices: {
    store: number;
    delivery: number;
  };
  nutrition: Nutrition;
}

export interface BaseEnrichedProduct extends Product {
  brand: Brand;
  category: Category;
  ingredients: Ingredient[];
  ingredientSlugs: string[];
  tags: Tag[];
  variants: EnrichedVariant[];
}

export interface CachedDataset {
  source: 'supabase' | 'memory';
  cachedAt: string;
  expiresAt: number;
  brands: Brand[];
  categories: Category[];
  ingredients: Ingredient[];
  tags: Tag[];
  products: Product[];
  productVariants: ProductVariant[];
  productPrices: ProductPrice[];
  nutritions: Nutrition[];
  productIngredients: ProductIngredient[];
  productTags: ProductTag[];
  baseEnrichedProducts: BaseEnrichedProduct[];
}

const DEFAULT_CACHE_TTL_MS =
  Number(process.env.DATASET_CACHE_TTL_MS) > 0
    ? Number(process.env.DATASET_CACHE_TTL_MS)
    : 10 * 60 * 1000; // 기본 10분 캐시 유지

let memoryCache: CachedDataset | null = null;
let inFlightPromise: Promise<CachedDataset> | null = null;

/**
 *原始 테이블 배열들을 조합해 미리 Join된 BaseEnrichedProduct 배열을 생성 (캐시 적재 시 1회만 수행)
 */
function buildBaseEnrichedProducts(data: {
  brands: Brand[];
  categories: Category[];
  ingredients: Ingredient[];
  tags: Tag[];
  products: Product[];
  productVariants: ProductVariant[];
  productPrices: ProductPrice[];
  nutritions: Nutrition[];
  productIngredients: ProductIngredient[];
  productTags: ProductTag[];
}): BaseEnrichedProduct[] {
  const brandById = new Map<number, Brand>(data.brands.map((b) => [b.id, b]));
  const brandBySlug = new Map<string, Brand>(data.brands.map((b) => [b.slug, b]));
  const seedBrandById = new Map<number, Brand>(seedBrands.map((b) => [b.id, b]));
  const categoryById = new Map<number, Category>(
    data.categories.map((c) => [c.id, c])
  );
  const ingredientById = new Map<number, Ingredient>(
    data.ingredients.map((i) => [i.id, i])
  );
  const tagById = new Map<number, Tag>(data.tags.map((t) => [t.id, t]));
  const nutritionByVariantId = new Map<number, Nutrition>(
    data.nutritions.map((n) => [n.productVariantId, n])
  );

  // product_id -> Ingredient[]
  const ingredientsByProductId = new Map<number, Ingredient[]>();
  const sortedProdIng = [...data.productIngredients].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  for (const pi of sortedProdIng) {
    const ing = ingredientById.get(pi.ingredientId);
    if (!ing) continue;
    const list = ingredientsByProductId.get(pi.productId) || [];
    list.push(ing);
    ingredientsByProductId.set(pi.productId, list);
  }

  // product_id -> Tag[]
  const tagsByProductId = new Map<number, Tag[]>();
  for (const pt of data.productTags) {
    const tag = tagById.get(pt.tagId);
    if (!tag) continue;
    const list = tagsByProductId.get(pt.productId) || [];
    list.push(tag);
    tagsByProductId.set(pt.productId, list);
  }

  // variant_id -> active prices
  const pricesByVariantId = new Map<
    number,
    { store: number; delivery: number }
  >();
  for (const pp of data.productPrices) {
    if (pp.endedAt !== null) continue;
    const entry = pricesByVariantId.get(pp.productVariantId) || {
      store: 0,
      delivery: 0,
    };
    if (pp.channel === 'STORE') entry.store = pp.price;
    if (pp.channel === 'DELIVERY') entry.delivery = pp.price;
    pricesByVariantId.set(pp.productVariantId, entry);
  }

  // product_id -> EnrichedVariant[]
  const variantsByProductId = new Map<number, EnrichedVariant[]>();
  for (const v of data.productVariants) {
    if (!v.isActive) continue;
    const prices = pricesByVariantId.get(v.id) || { store: 0, delivery: 0 };
    const nutrition = nutritionByVariantId.get(v.id) || {
      id: 0,
      productVariantId: v.id,
      servingSizeG: 0,
      caloriesKcal: 0,
      proteinG: 0,
      sugarG: 0,
      saturatedFatG: 0,
      sodiumMg: 0,
    };
    const list = variantsByProductId.get(v.productId) || [];
    list.push({
      id: v.id,
      name: v.name,
      variantType: v.variantType,
      isDefault: v.isDefault,
      prices,
      nutrition,
    });
    variantsByProductId.set(v.productId, list);
  }

  return data.products
    .filter((p) => p.status === 'ACTIVE')
    .map((product) => {
      const seedBrandSlug = seedBrandById.get(product.brandId)?.slug;
      const brand =
        brandById.get(product.brandId) ||
        (seedBrandSlug ? brandBySlug.get(seedBrandSlug) : undefined) ||
        seedBrandById.get(product.brandId) || {
          id: product.brandId,
          name: '기타 브랜드',
          slug: 'other',
          isActive: true,
        };

      const category =
        categoryById.get(product.categoryId) || seedCategories[0];
      const prodIngredients = ingredientsByProductId.get(product.id) || [];
      const prodTags = tagsByProductId.get(product.id) || [];
      const variants = variantsByProductId.get(product.id) || [];

      return {
        ...product,
        brand,
        category,
        ingredients: prodIngredients,
        ingredientSlugs: prodIngredients.map((i) => i.slug),
        tags: prodTags,
        variants,
      };
    });
}

/**
 * Supabase DB에서 10개 테이블을 단 1번의 병렬 라운드트립(Promise.all)으로 조회
 */
async function fetchDatasetFromSupabase(): Promise<CachedDataset> {
  const pool = getDbPool();

  let dbBrands: Brand[] = [];
  try {
    const [
      brandsRes,
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
      pool.query(
        'SELECT id, name, slug, logo_url, homepage_url, is_active FROM brands ORDER BY id ASC'
      ),
      pool.query('SELECT id, name, slug FROM categories ORDER BY id'),
      pool.query(
        'SELECT id, name, slug, ingredient_group FROM ingredients ORDER BY id'
      ),
      pool.query('SELECT id, name, slug FROM tags ORDER BY id'),
      pool.query(
        'SELECT id, brand_id, category_id, name, slug, description, image_url, status, is_limited FROM products ORDER BY id'
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
            imageUrl: r.image_url ?? undefined,
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

    const baseEnrichedProducts = buildBaseEnrichedProducts({
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
    });

    const now = Date.now();
    return {
      source: 'supabase',
      cachedAt: new Date(now).toISOString(),
      expiresAt: now + DEFAULT_CACHE_TTL_MS,
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
      baseEnrichedProducts,
    };
  } catch (err) {
    console.warn(
      '⚠️ 일부 테이블 조회 실패, brands는 Supabase DB 값을 유지하고 나머지는 시드를 사용합니다:',
      err
    );
    const brands = dbBrands.length > 0 ? dbBrands : seedBrands;
    const baseEnrichedProducts = buildBaseEnrichedProducts({
      brands,
      categories: seedCategories,
      ingredients: seedIngredients,
      tags: seedTags,
      products: seedProducts,
      productVariants: seedProductVariants,
      productPrices: seedProductPrices,
      nutritions: seedNutritions,
      productIngredients: seedProductIngredients,
      productTags: seedProductTags,
    });
    const now = Date.now();
    return {
      source: dbBrands.length > 0 ? 'supabase' : 'memory',
      cachedAt: new Date(now).toISOString(),
      expiresAt: now + DEFAULT_CACHE_TTL_MS,
      brands,
      categories: seedCategories,
      ingredients: seedIngredients,
      tags: seedTags,
      products: seedProducts,
      productVariants: seedProductVariants,
      productPrices: seedProductPrices,
      nutritions: seedNutritions,
      productIngredients: seedProductIngredients,
      productTags: seedProductTags,
      baseEnrichedProducts,
    };
  }
}

/**
 * DB의 products.image_url을 조회해 캐시된 상품 목록의 imageUrl에 반영한다.
 * 관리자에서 이미지를 등록·변경했을 때 10분 캐시 만료를 기다리지 않고 즉시 반영되도록 한다.
 */
async function syncProductImagesFromDb(dataset: CachedDataset): Promise<void> {
  try {
    const pool = getDbPool();
    const { rows } = await pool.query<{
      id: string;
      name: string;
      slug: string;
      image_url: string | null;
    }>('SELECT id, name, slug, image_url FROM products');
    if (rows.length === 0) return;

    const norm = (s: string) => s.toLowerCase().replace(/[\s-_]/g, '');
    const byId = new Map<number, string | undefined>();
    const bySlug = new Map<string, string | undefined>();
    const byName = new Map<string, string | undefined>();

    for (const r of rows) {
      const url = r.image_url?.trim() ? r.image_url.trim() : undefined;
      byId.set(Number(r.id), url);
      bySlug.set(norm(r.slug), url);
      byName.set(norm(r.name), url);
    }

    const resolveUrl = (p: { id: number; slug: string; name: string }) =>
      bySlug.get(norm(p.slug)) ?? byName.get(norm(p.name)) ?? byId.get(p.id);

    for (const p of dataset.products) {
      p.imageUrl = resolveUrl(p);
    }
    for (const ep of dataset.baseEnrichedProducts) {
      ep.imageUrl = resolveUrl(ep);
    }
  } catch {
    // DB 이미지 조회 실패 시 기존 캐시 유지
  }
}

/**
 * Node.js 인메모리 캐시 조회 (Singleflight 지원)
 * - 캐시가 유효하면 DB 쿼리 없이 0ms 반환 (단, 상품 이미지는 DB 최신값 반영)
 * - 동시 다발적인 요청이 들어와도 inFlightPromise를 공유하여 DB는 딱 1번만 조회
 * - forceRefresh=true 전달 시 캐시 즉시 무효화 후 재적재
 */
export async function getCachedDataset(options?: {
  forceRefresh?: boolean;
}): Promise<{ dataset: CachedDataset; cacheHit: boolean }> {
  const forceRefresh = options?.forceRefresh === true;
  const now = Date.now();

  if (!forceRefresh && memoryCache && memoryCache.expiresAt > now) {
    await syncProductImagesFromDb(memoryCache);
    return { dataset: memoryCache, cacheHit: true };
  }

  if (forceRefresh) {
    memoryCache = null;
    inFlightPromise = null;
  }

  if (!inFlightPromise) {
    inFlightPromise = fetchDatasetFromSupabase()
      .then(async (fresh) => {
        await syncProductImagesFromDb(fresh);
        memoryCache = fresh;
        return fresh;
      })
      .finally(() => {
        inFlightPromise = null;
      });
  }

  const dataset = await inFlightPromise;
  return { dataset, cacheHit: false };
}

/**
 * 수동 캐시 무효화 함수
 */
export function invalidateDatasetCache(): void {
  memoryCache = null;
  inFlightPromise = null;
}

/**
 * 서버 시작 시점에 백그라운드로 DB 커넥션 및 인메모리 캐시를 미리 워밍(Pre-warming)
 */
export async function prewarmDatasetCache(): Promise<void> {
  const startedAt = Date.now();
  try {
    const { dataset } = await getCachedDataset({ forceRefresh: true });
    const elapsedMs = Date.now() - startedAt;
    console.log(
      `⚡ [Cache Pre-warm 완료] ${dataset.brands.length}개 브랜드 / ${dataset.products.length}개 버거 인메모리 캐싱 완료 (${elapsedMs}ms)`
    );
  } catch (error) {
    console.warn(
      '⚠️ [Cache Pre-warm 실패] 첫 요청 시 재시도합니다:',
      error instanceof Error ? error.message : String(error)
    );
  }
}

/** 검색·추천 화면의 조건 (프론트 recommend/page.tsx 의 상태와 같은 모양) */
export interface SearchFilters {
  keyword: string;
  brands: string[];
  includeIngredients: string[];
  excludeIngredients: string[];
  minPrice: number | null;
  maxPrice: number | null;
  priceChannel: 'STORE' | 'DELIVERY';
  maxCalories: number | null;
  variantType: 'SINGLE' | 'SET';
  sortBy: 'calories_asc' | 'calories_desc' | 'price_asc' | 'price_desc' | 'protein_desc';
}

export interface SavedSearch {
  savedSearchId: string;
  name: string;
  filters: SearchFilters;
  createdAt: string;
}

/** 한 회원이 저장할 수 있는 최대 개수 */
export const MAX_SAVED_SEARCHES = 10;

export class SavedSearchInvalid extends Error {}
export class SavedSearchLimitExceeded extends Error {
  constructor() { super(`검색 조건은 ${MAX_SAVED_SEARCHES}개까지 저장할 수 있어요.`); }
}

const SLUG = /^[a-z0-9-]{1,50}$/;
const SORTS = ['calories_asc', 'calories_desc', 'price_asc', 'price_desc', 'protein_desc'] as const;

function slugList(value: unknown, field: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 20 || !value.every((v) => typeof v === 'string' && SLUG.test(v))) {
    throw new SavedSearchInvalid(`${field} 값이 올바르지 않습니다.`);
  }
  return [...new Set(value as string[])];
}

function amount(value: unknown, field: string, max: number): number | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0 || value > max) {
    throw new SavedSearchInvalid(`${field} 값이 올바르지 않습니다.`);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T, field: string): T {
  if (value === undefined) return fallback;
  if (!allowed.includes(value as T)) throw new SavedSearchInvalid(`${field} 값이 올바르지 않습니다.`);
  return value as T;
}

/** 이름(1~30자)과 조건을 검증하고, 알 수 없는 필드는 버린다. */
export function parseSavedSearchInput(body: unknown): { name: string; filters: SearchFilters } {
  const input = body as { name?: unknown; filters?: Record<string, unknown> } | null;
  const name = typeof input?.name === 'string' ? input.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || [...name].length > 30) throw new SavedSearchInvalid('조건 이름은 1~30자로 입력해 주세요.');
  const f = input?.filters;
  if (!f || typeof f !== 'object' || Array.isArray(f)) throw new SavedSearchInvalid('저장할 조건이 없습니다.');

  const keyword = f.keyword === undefined ? '' : f.keyword;
  if (typeof keyword !== 'string' || [...keyword].length > 50) throw new SavedSearchInvalid('검색어는 50자까지 저장할 수 있어요.');
  const minPrice = amount(f.minPrice, '최소 금액', 100000);
  const maxPrice = amount(f.maxPrice, '최대 금액', 100000);
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw new SavedSearchInvalid('최소 금액이 최대 금액보다 클 수 없습니다.');
  }

  const includeIngredients = slugList(f.includeIngredients, '포함 재료');
  const excludeIngredients = slugList(f.excludeIngredients, '제외 재료');
  if (includeIngredients.some((slug) => excludeIngredients.includes(slug))) {
    throw new SavedSearchInvalid('같은 재료를 포함과 제외에 함께 넣을 수 없습니다.');
  }

  return {
    name,
    filters: {
      keyword: keyword.trim(),
      brands: slugList(f.brands, '브랜드'),
      includeIngredients,
      excludeIngredients,
      minPrice,
      maxPrice,
      priceChannel: oneOf(f.priceChannel, ['STORE', 'DELIVERY'] as const, 'STORE', '가격 기준'),
      maxCalories: amount(f.maxCalories, '최대 칼로리', 5000),
      variantType: oneOf(f.variantType, ['SINGLE', 'SET'] as const, 'SINGLE', '판매 형태'),
      sortBy: oneOf(f.sortBy, SORTS, 'calories_asc', '정렬'),
    },
  };
}

export const canSaveMore = (currentCount: number) => currentCount < MAX_SAVED_SEARCHES;

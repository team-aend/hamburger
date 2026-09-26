export type PattyType = 'BEEF' | 'CHICKEN' | 'SHRIMP' | 'OTHER';

export type ProductCategory = 'BURGER';

export interface Brand {
  id: number;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  brand: Brand;
  category: ProductCategory;
  name: string;
  slug: string;
  imageUrl?: string;
  singlePrice: number;
  setPrice?: number;
  calories?: number;
  protein?: number;
  pattyType: PattyType;
}

export type SortType =
  | 'DEFAULT'
  | 'PRICE_ASC'
  | 'PRICE_DESC'
  | 'CALORIES_ASC'
  | 'PROTEIN_DESC';

export const PATTY_TYPE_LABEL: Record<PattyType, string> = {
  BEEF: '비프',
  CHICKEN: '치킨',
  SHRIMP: '새우',
  OTHER: '기타',
};

export const SORT_OPTIONS: { value: SortType; label: string }[] = [
  { value: 'DEFAULT', label: '기본순' },
  { value: 'PRICE_ASC', label: '가격 낮은순' },
  { value: 'PRICE_DESC', label: '가격 높은순' },
  { value: 'CALORIES_ASC', label: '칼로리 낮은순' },
  { value: 'PROTEIN_DESC', label: '단백질 높은순' },
];

export const MAX_COMPARE_COUNT = 4;
export const MIN_COMPARE_COUNT = 2;

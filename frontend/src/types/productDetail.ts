/** GET /api/products/:id 응답 (backend/src/products/application/getProductDetail.ts 와 같은 모양, ID 는 문자열) */
export interface ProductDetail {
  productId: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string | null;
  status: string;
  isLimited: boolean;
  brand: { brandId: string; name: string; slug: string; logoUrl: string | null };
  category: string;
  ingredients: { name: string; slug: string; group: string }[];
  tags: { name: string; slug: string }[];
  variants: ProductVariantDetail[];
  priceHistory: PriceHistoryRow[];
  likes: { count: number; liked: boolean };
  reviews: { averageRating: number; totalCount: number };
  worldcup: {
    championships: number;
    appearances: number;
    matches: number;
    wins: number;
    rank: number | null;
  };
  similar: {
    productId: string;
    name: string;
    brandName: string;
    singlePrice: number | null;
    caloriesKcal: number | null;
    reason: string;
  }[];
}

export interface ProductVariantDetail {
  variantId: string;
  name: string;
  variantType: string;
  isDefault: boolean;
  prices: { store: number | null; delivery: number | null };
  nutrition: {
    servingSizeG: number | null;
    caloriesKcal: number | null;
    proteinG: number | null;
    sugarG: number | null;
    saturatedFatG: number | null;
    sodiumMg: number | null;
  } | null;
}

export interface PriceHistoryRow {
  variantId: string;
  channel: 'STORE' | 'DELIVERY';
  price: number;
  startedAt: string;
  endedAt: string | null;
}

export const PRICE_CHANNELS = [
  // 색은 dataviz 검증 스크립트로 확인한 조합 (색약 구분 ΔE 19, 배경 대비 3:1 이상)
  { key: 'STORE', label: '매장가', color: '#e8432f' },
  { key: 'DELIVERY', label: '배달가', color: '#3f6fb0' },
] as const;

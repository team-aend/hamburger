import { pickSimilarProducts, type SimilarCandidate, type SimilarProduct } from '../domain/similarProducts.js';

export class ProductsStorageUnavailable extends Error {
  constructor() { super('products storage unavailable'); }
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
  /** 모든 가격 기록 (현재 가격 포함), 오래된 순 */
  priceHistory: PriceHistoryRow[];
  likes: { count: number; liked: boolean };
  reviews: { averageRating: number; totalCount: number };
  /** 완료된 월드컵 세션 기준 (랭킹 화면과 같은 기준) */
  worldcup: { championships: number; appearances: number; matches: number; wins: number; rank: number | null };
  similar: SimilarProduct[];
}

export interface ProductDetailRepository {
  findDetail(productId: string, userId: number | null): Promise<Omit<ProductDetail, 'similar'> | null>;
  /** 판매 중인 버거 전체 (비슷한 버거 후보) */
  listSimilarCandidates(): Promise<SimilarCandidate[]>;
}

export const createGetProductDetail = (repository: ProductDetailRepository) =>
  async (productId: string, userId: number | null): Promise<ProductDetail | null> => {
    const detail = await repository.findDetail(productId, userId);
    if (!detail) return null;
    const candidates = await repository.listSimilarCandidates();
    const target = candidates.find((c) => c.productId === productId);
    return { ...detail, similar: target ? pickSimilarProducts(target, candidates) : [] };
  };

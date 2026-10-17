import type { Brand, PattyType, Product } from '@/types/product';

/** GET /api/recommend 응답의 items 한 개 (햄버거 비교 화면에 필요한 필드만) */
export interface RecommendItem {
  id: number;
  name: string;
  slug: string;
  imageUrl?: string | null;
  brand: Brand;
  ingredients: { slug: string; group: string }[];
  variants: {
    variantType: 'SINGLE' | 'SET';
    prices: { store: number };
    nutrition?: { caloriesKcal?: number | null; proteinG?: number | null } | null;
  }[];
}

/** 패티가 여러 개면 앞쪽을 우선한다. (예: 통새우와퍼는 비프+새우 → 새우) */
const PATTY_PRIORITY: [slug: string, type: PattyType][] = [
  ['shrimp-patty', 'SHRIMP'],
  ['chicken-patty', 'CHICKEN'],
  ['beef-patty', 'BEEF'],
];

function toPattyType(item: RecommendItem): PattyType {
  const pattySlugs = item.ingredients.filter((i) => i.group === 'PATTY').map((i) => i.slug);
  return PATTY_PRIORITY.find(([slug]) => pattySlugs.includes(slug))?.[1] ?? 'OTHER';
}

/** DB 상품 → 햄버거 비교 화면의 Product. 단품(SINGLE) 매장가가 없으면 비교할 수 없어 제외한다. */
export function toProduct(item: RecommendItem): Product | null {
  const single = item.variants.find((v) => v.variantType === 'SINGLE');
  const set = item.variants.find((v) => v.variantType === 'SET');
  if (!single) return null;

  return {
    id: item.id,
    brand: item.brand,
    category: 'BURGER',
    name: item.name,
    slug: item.slug,
    imageUrl: item.imageUrl ?? undefined,
    singlePrice: single.prices.store,
    setPrice: set?.prices.store,
    calories: single.nutrition?.caloriesKcal ?? undefined,
    protein: single.nutrition?.proteinG ?? undefined,
    pattyType: toPattyType(item),
  };
}

/** '기본순'이 매번 같도록 상품 번호 순으로 정렬해 돌려준다. */
export function toProducts(items: RecommendItem[]): Product[] {
  return items
    .map(toProduct)
    .filter((product): product is Product => product !== null)
    .sort((a, b) => a.id - b.id);
}

/** 상품은 DB에서만 가져온다. 실패하면 null (화면에 오류 안내, Mock 으로 대체하지 않음) */
export async function fetchProducts(
  backendUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<Product[] | null> {
  try {
    const res = await fetchImpl(`${backendUrl}/api/recommend`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data: { items?: RecommendItem[] } = await res.json();
    return Array.isArray(data.items) ? toProducts(data.items) : null;
  } catch {
    return null;
  }
}

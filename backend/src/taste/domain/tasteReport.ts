export interface TasteProduct {
  productId: string;
  name: string;
  brandName: string;
  singlePrice: number | null;
  caloriesKcal: number | null;
  /** 패티 재료 이름 (예: '치킨 패티') */
  patties: string[];
}

export interface TasteSignals {
  likes: TasteProduct[];
  worldcupWins: { product: TasteProduct; count: number }[];
  /** 별점 4점 이상 한 줄 평을 남긴 버거 */
  highRatings: TasteProduct[];
}

export interface TasteShare {
  label: string;
  /** 0~100 (%) */
  share: number;
}

export interface TasteRecommendation {
  productId: string;
  name: string;
  brandName: string;
  singlePrice: number | null;
  reasons: string[];
}

export interface TasteReport {
  /** 취향을 말할 만큼 기록이 쌓였는지 */
  enough: boolean;
  sources: { likes: number; worldcupWins: number; highRatings: number };
  patties: TasteShare[];
  brands: TasteShare[];
  averagePrice: number | null;
  priceBand: string | null;
  averageCalories: number | null;
  /** 예: '치킨 패티파 · 6천원대 · 맘스터치 선호' */
  summary: string | null;
  recommendations: TasteRecommendation[];
}

/** 신호 1개의 무게. 월드컵 우승은 여러 버거 중 끝까지 고른 것이라 더 무겁게 본다. */
export const SIGNAL_WEIGHT = { like: 2, worldcupWin: 3, highRating: 2 } as const;
/** 이 무게 이상 쌓여야 취향을 요약한다. (예: 좋아요 3개, 또는 월드컵 우승 2번) */
export const MIN_SIGNAL_WEIGHT = 6;

const priceBandOf = (price: number) => `${Math.floor(price / 1000).toLocaleString('ko-KR')}천원대`;

function shares(weights: Map<string, number>, limit: number): TasteShare[] {
  const total = [...weights.values()].reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return [...weights]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([label, weight]) => ({ label, share: Math.round((weight / total) * 100) }));
}

export function buildTasteReport(signals: TasteSignals, candidates: TasteProduct[]): TasteReport {
  // 상품별 무게 합산 (같은 버거를 좋아요도 하고 우승도 시켰으면 더한다)
  const weighted = new Map<string, { product: TasteProduct; weight: number }>();
  const add = (product: TasteProduct, weight: number) => {
    const entry = weighted.get(product.productId) ?? { product, weight: 0 };
    entry.weight += weight;
    weighted.set(product.productId, entry);
  };
  signals.likes.forEach((p) => add(p, SIGNAL_WEIGHT.like));
  signals.worldcupWins.forEach(({ product, count }) => add(product, SIGNAL_WEIGHT.worldcupWin * count));
  signals.highRatings.forEach((p) => add(p, SIGNAL_WEIGHT.highRating));

  const entries = [...weighted.values()];
  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);
  const sources = {
    likes: signals.likes.length,
    worldcupWins: signals.worldcupWins.reduce((sum, w) => sum + w.count, 0),
    highRatings: signals.highRatings.length,
  };

  const pattyWeights = new Map<string, number>();
  const brandWeights = new Map<string, number>();
  let priceSum = 0, priceWeight = 0, kcalSum = 0, kcalWeight = 0;
  for (const { product, weight } of entries) {
    for (const patty of product.patties) {
      pattyWeights.set(patty, (pattyWeights.get(patty) ?? 0) + weight / product.patties.length);
    }
    brandWeights.set(product.brandName, (brandWeights.get(product.brandName) ?? 0) + weight);
    if (product.singlePrice !== null) { priceSum += product.singlePrice * weight; priceWeight += weight; }
    if (product.caloriesKcal !== null) { kcalSum += product.caloriesKcal * weight; kcalWeight += weight; }
  }

  const patties = shares(pattyWeights, 3);
  const brands = shares(brandWeights, 3);
  const averagePrice = priceWeight ? Math.round(priceSum / priceWeight / 100) * 100 : null;
  const averageCalories = kcalWeight ? Math.round(kcalSum / kcalWeight / 10) * 10 : null;
  const priceBand = averagePrice === null ? null : priceBandOf(averagePrice);
  const enough = totalWeight >= MIN_SIGNAL_WEIGHT;

  const base = { enough, sources, patties, brands, averagePrice, priceBand, averageCalories };
  if (!enough) return { ...base, summary: null, recommendations: [] };

  const topPatty = patties[0]?.label ?? null;
  const topBrand = brands[0]?.label ?? null;
  const summary = [topPatty && `${topPatty}파`, priceBand, topBrand && `${topBrand} 선호`].filter(Boolean).join(' · ');

  // 아직 고르지 않은 버거 중 취향에 맞는 것: 1순위 패티 > 좋아하는 다른 패티, 선호 브랜드, 같은 가격대
  const known = new Set(weighted.keys());
  const recommendations = candidates
    .filter((c) => !known.has(c.productId))
    .map((c) => {
      const reasons: string[] = [];
      let score = 0;
      if (topPatty && c.patties.includes(topPatty)) { score += 3; reasons.push(`좋아하는 ${topPatty}`); }
      else if (c.patties.some((p) => pattyWeights.has(p))) { score += 1.5; reasons.push('자주 고른 패티'); }
      if (topBrand && c.brandName === topBrand) { score += 1; reasons.push(`${topBrand}`); }
      if (averagePrice !== null && c.singlePrice !== null && Math.abs(c.singlePrice - averagePrice) <= 1000) {
        score += 1;
        reasons.push(priceBandOf(c.singlePrice));
      }
      return { c, score, reasons };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.c.productId.localeCompare(b.c.productId))
    .slice(0, 3)
    .map(({ c, reasons }) => ({
      productId: c.productId, name: c.name, brandName: c.brandName, singlePrice: c.singlePrice, reasons,
    }));

  return { ...base, summary: summary || null, recommendations };
}

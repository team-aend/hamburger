export interface SimilarCandidate {
  productId: string;
  name: string;
  brandName: string;
  singlePrice: number | null;
  caloriesKcal: number | null;
  patties: { slug: string; name: string }[];
}

export interface SimilarProduct {
  productId: string;
  name: string;
  brandName: string;
  singlePrice: number | null;
  caloriesKcal: number | null;
  reason: string;
}

/** 이 금액 이내면 "비슷한 가격대" */
export const SIMILAR_PRICE_GAP = 1000;

/**
 * 비슷한 버거: 같은 패티를 쓰는 버거를 먼저, 그다음 단품 가격이 가까운 순.
 * 가격을 모르는 버거는 가장 멀리 있는 것으로 본다.
 */
export function pickSimilarProducts(
  target: SimilarCandidate,
  candidates: SimilarCandidate[],
  limit = 4,
): SimilarProduct[] {
  const targetPatties = new Set(target.patties.map((p) => p.slug));
  const gapOf = (c: SimilarCandidate) =>
    c.singlePrice === null || target.singlePrice === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(c.singlePrice - target.singlePrice);

  return candidates
    .filter((c) => c.productId !== target.productId)
    .map((c) => ({ candidate: c, sharedPatty: c.patties.find((p) => targetPatties.has(p.slug)), gap: gapOf(c) }))
    .sort((a, b) =>
      Number(Boolean(b.sharedPatty)) - Number(Boolean(a.sharedPatty)) ||
      a.gap - b.gap ||
      a.candidate.productId.localeCompare(b.candidate.productId))
    .slice(0, limit)
    .map(({ candidate, sharedPatty, gap }) => ({
      productId: candidate.productId,
      name: candidate.name,
      brandName: candidate.brandName,
      singlePrice: candidate.singlePrice,
      caloriesKcal: candidate.caloriesKcal,
      reason: sharedPatty ? `같은 ${sharedPatty.name}` : gap <= SIMILAR_PRICE_GAP ? '비슷한 가격대' : '다른 브랜드 추천',
    }));
}

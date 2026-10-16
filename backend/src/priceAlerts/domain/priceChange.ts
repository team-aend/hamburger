/** 좋아요한 버거 1개의 가격 스냅샷 (단품 매장가 기준) */
export interface LikedPriceSnapshot {
  productId: string;
  /** 좋아요를 누른 시점에 유효했던 가격 (그 전 기록이 없으면 null) */
  priceAtLike: number | null;
  /** 지금 유효한 가격 (없으면 null) */
  currentPrice: number | null;
  /** 지금 가격이 적용되기 시작한 시각 */
  currentSince: string | null;
}

export interface PriceChange {
  productId: string;
  previousPrice: number;
  currentPrice: number;
  changedAt: string;
  direction: 'UP' | 'DOWN';
  /** 마지막으로 확인한 뒤에 바뀐 가격인지 */
  isNew: boolean;
}

/**
 * 좋아요한 뒤 가격이 바뀐 버거만 고른다. 최근에 바뀐 순.
 * - 좋아요 시점 가격이나 현재 가격을 모르면 비교하지 않는다.
 * - 한 번도 확인한 적이 없으면(seenAt=null) 모두 새 알림이다.
 */
export function detectPriceChanges(snapshots: LikedPriceSnapshot[], seenAt: string | null): PriceChange[] {
  const seen = seenAt === null ? null : Date.parse(seenAt);
  return snapshots
    .filter((s): s is LikedPriceSnapshot & { priceAtLike: number; currentPrice: number; currentSince: string } =>
      s.priceAtLike !== null && s.currentPrice !== null && s.currentSince !== null && s.priceAtLike !== s.currentPrice)
    .map((s) => ({
      productId: s.productId,
      previousPrice: s.priceAtLike,
      currentPrice: s.currentPrice,
      changedAt: s.currentSince,
      direction: s.currentPrice > s.priceAtLike ? 'UP' as const : 'DOWN' as const,
      isNew: seen === null || Date.parse(s.currentSince) > seen,
    }))
    .sort((a, b) => Date.parse(b.changedAt) - Date.parse(a.changedAt) || a.productId.localeCompare(b.productId));
}

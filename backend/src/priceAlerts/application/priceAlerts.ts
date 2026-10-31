import { detectPriceChanges, type LikedPriceSnapshot, type PriceChange } from '../domain/priceChange.js';

export interface PriceAlertsRepository {
  /** 좋아요한 버거들의 가격 스냅샷과 마지막 확인 시각 (같은 시점의 데이터) */
  likedSnapshots(userId: number): Promise<{ snapshots: LikedPriceSnapshot[]; seenAt: string | null }>;
  markSeen(userId: number): Promise<void>;
}

export interface PriceAlerts {
  changes(userId: number): Promise<PriceChange[]>;
  countNew(userId: number): Promise<number>;
  markSeen(userId: number): Promise<void>;
}

export function createPriceAlerts(repository: PriceAlertsRepository): PriceAlerts {
  const changes = async (userId: number) => {
    const { snapshots, seenAt } = await repository.likedSnapshots(userId);
    return detectPriceChanges(snapshots, seenAt);
  };
  return {
    changes,
    countNew: async (userId) => (await changes(userId)).filter((c) => c.isNew).length,
    markSeen: (userId) => repository.markSeen(userId),
  };
}

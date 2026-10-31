import type { Product } from '@/types/product';
import type { ReviewsSummaryMap } from '@/types/review';
import ProductCard from './ProductCard';
import styles from './ProductGrid.module.css';

interface ProductGridProps {
  products: Product[];
  selectedIds: number[];
  onToggleCompare: (product: Product) => void;
  onResetFilters: () => void;
  likeCounts: Record<number, number>;
  likedIds: Set<number>;
  pendingLikeIds: Set<number>;
  onToggleLike: (productId: number) => void;
  reviewsSummary?: ReviewsSummaryMap;
  onOpenReviews?: (product: Product) => void;
}

export default function ProductGrid({
  products,
  selectedIds,
  onToggleCompare,
  onResetFilters,
  likeCounts,
  likedIds,
  pendingLikeIds,
  onToggleLike,
  reviewsSummary,
  onOpenReviews,
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyTitle}>조건에 맞는 햄버거가 없어요.</p>
        <p className={styles.emptyText}>검색어나 필터를 변경해보세요.</p>
        <button type="button" className={styles.resetButton} onClick={onResetFilters}>
          필터 초기화
        </button>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {products.map((product) => (
        <ProductCard
          key={product.id}
          product={product}
          selected={selectedIds.includes(product.id)}
          onToggleCompare={onToggleCompare}
          liked={likedIds.has(product.id)}
          likeCount={likeCounts[product.id] ?? 0}
          likePending={pendingLikeIds.has(product.id)}
          onToggleLike={onToggleLike}
          reviewSummary={reviewsSummary?.[product.id]}
          onOpenReviews={onOpenReviews}
        />
      ))}
    </div>
  );
}

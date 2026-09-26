import type { Product } from '@/types/product';
import ProductCard from './ProductCard';
import styles from './ProductGrid.module.css';

interface ProductGridProps {
  products: Product[];
  selectedIds: number[];
  onToggleCompare: (product: Product) => void;
  onResetFilters: () => void;
}

export default function ProductGrid({
  products,
  selectedIds,
  onToggleCompare,
  onResetFilters,
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
        />
      ))}
    </div>
  );
}

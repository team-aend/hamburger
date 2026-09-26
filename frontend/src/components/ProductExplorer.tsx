'use client';

import { useEffect, useRef, useState } from 'react';
import CompareBar from '@/components/compare/CompareBar';
import CompareTable from '@/components/compare/CompareTable';
import BrandFilter from '@/components/filter/BrandFilter';
import PattyFilter from '@/components/filter/PattyFilter';
import ProductSort from '@/components/filter/ProductSort';
import SearchBar from '@/components/filter/SearchBar';
import ProductGrid from '@/components/product/ProductGrid';
import { useProductFilters } from '@/hooks/useProductFilters';
import {
  MAX_COMPARE_COUNT,
  MIN_COMPARE_COUNT,
  type Product,
} from '@/types/product';
import styles from './ProductExplorer.module.css';

interface ProductExplorerProps {
  products: Product[];
}

export default function ProductExplorer({ products }: ProductExplorerProps) {
  const {
    searchKeyword,
    setSearchKeyword,
    selectedBrand,
    setSelectedBrand,
    selectedPattyType,
    setSelectedPattyType,
    sortType,
    setSortType,
    filteredProducts,
    resetFilters,
  } = useProductFilters(products);

  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const comparisonRef = useRef<HTMLElement>(null);

  // 안내 메시지는 잠시 후 자동으로 사라진다.
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  const toggleCompare = (product: Product) => {
    setSelectedProducts((prev) => {
      const exists = prev.some((item) => item.id === product.id);

      if (exists) {
        const next = prev.filter((item) => item.id !== product.id);
        if (next.length < MIN_COMPARE_COUNT) setShowComparison(false);
        return next;
      }

      if (prev.length >= MAX_COMPARE_COUNT) {
        setNotice(`최대 ${MAX_COMPARE_COUNT}개까지 비교할 수 있어요.`);
        return prev;
      }

      setNotice(null);
      return [...prev, product];
    });
  };

  const removeFromCompare = (productId: number) => {
    setSelectedProducts((prev) => {
      const next = prev.filter((item) => item.id !== productId);
      if (next.length < MIN_COMPARE_COUNT) setShowComparison(false);
      return next;
    });
  };

  const resetCompare = () => {
    setSelectedProducts([]);
    setShowComparison(false);
    setNotice(null);
  };

  // 비교 영역이 그려진 다음에 해당 위치로 스크롤한다.
  useEffect(() => {
    if (!showComparison) return;
    comparisonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [showComparison]);

  const selectedIds = selectedProducts.map((product) => product.id);

  return (
    <div className={styles.page}>
      <main
        className={`${styles.main} ${
          selectedProducts.length > 0 ? styles.mainWithBar : ''
        }`}
      >
        <section className={styles.filters} aria-label="검색 및 필터">
          <SearchBar value={searchKeyword} onChange={setSearchKeyword} />
          <BrandFilter value={selectedBrand} onChange={setSelectedBrand} />
          <PattyFilter value={selectedPattyType} onChange={setSelectedPattyType} />
        </section>

        <div className={styles.listHeader}>
          <p className={styles.count}>
            햄버거 <strong>{filteredProducts.length}개</strong>
          </p>
          <ProductSort value={sortType} onChange={setSortType} />
        </div>

        <ProductGrid
          products={filteredProducts}
          selectedIds={selectedIds}
          onToggleCompare={toggleCompare}
          onResetFilters={resetFilters}
        />

        {showComparison && selectedProducts.length >= MIN_COMPARE_COUNT && (
          <section className={styles.comparison} ref={comparisonRef} aria-label="햄버거 비교">
            <div className={styles.comparisonHeader}>
              <h2 className={styles.comparisonTitle}>햄버거 비교</h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowComparison(false)}
              >
                닫기
              </button>
            </div>
            <CompareTable products={selectedProducts} />
          </section>
        )}
      </main>

      {selectedProducts.length > 0 && (
        <CompareBar
          selectedProducts={selectedProducts}
          onRemove={removeFromCompare}
          onReset={resetCompare}
          onCompare={() => setShowComparison(true)}
          notice={notice}
        />
      )}
    </div>
  );
}

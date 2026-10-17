'use client';

import { useEffect, useRef, useState } from 'react';
import CompareBar from '@/components/compare/CompareBar';
import CompareTable from '@/components/compare/CompareTable';
import BrandFilter from '@/components/filter/BrandFilter';
import PattyFilter from '@/components/filter/PattyFilter';
import ProductSort from '@/components/filter/ProductSort';
import SearchBar from '@/components/filter/SearchBar';
import ProductGrid from '@/components/product/ProductGrid';
import SiteHeader from '@/components/SiteHeader';
import ReviewModal from '@/components/review/ReviewModal';
import { useProductFilters } from '@/hooks/useProductFilters';
import { useProductLikes } from '@/hooks/useProductLikes';
import { useProductReviews } from '@/hooks/useProductReviews';
import { BRANDS } from '@/data/brands';
import {
  MAX_COMPARE_COUNT,
  MIN_COMPARE_COUNT,
  type Brand,
  type Product,
} from '@/types/product';
import styles from './ProductExplorer.module.css';

interface ProductExplorerProps {
  products: Product[];
  initialBrands?: Brand[];
  /** 상품 목록 조회 실패 안내 문구 */
  loadError?: string;
}

export default function ProductExplorer({
  products,
  initialBrands,
  loadError,
}: ProductExplorerProps) {
  const [brands, setBrands] = useState<Brand[]>(
    initialBrands && initialBrands.length > 0 ? initialBrands : BRANDS
  );

  useEffect(() => {
    let ignore = false;
    fetch('/api/brands')
      .then((res) => {
        if (!res.ok) throw new Error('브랜드 목록을 불러오지 못했습니다.');
        return res.json();
      })
      .then((data: { brands?: Brand[] }) => {
        if (!ignore && data.brands && Array.isArray(data.brands) && data.brands.length > 0) {
          setBrands(data.brands);
        }
      })
      .catch((err) => {
        console.warn('DB 브랜드 목록 조회 실패 (fallback 유지):', err);
      });

    return () => {
      ignore = true;
    };
  }, []);

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

  const {
    counts: likeCounts,
    likedIds,
    pendingIds: pendingLikeIds,
    toggleLike,
    error: likeError,
  } = useProductLikes(products.map((product) => product.id));

  const {
    summaries: reviewsSummary,
    activeProductId,
    activeReviews,
    activeSummary,
    isLoadingReviews,
    openReviewsForProduct,
    closeReviews,
    submitReview,
    deleteReview,
  } = useProductReviews(products.map((product) => product.id));

  const activeReviewProduct = activeProductId
    ? products.find((p) => p.id === activeProductId) ?? null
    : null;

  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [showComparison, setShowComparison] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const comparisonRef = useRef<HTMLElement>(null);

  // 마이페이지 등에서 /compare?compare=1,2,3 으로 들어오면 해당 상품을 미리 담아 둔다.
  useEffect(() => {
    const ids = (new URLSearchParams(window.location.search).get('compare') ?? '')
      .split(',')
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0);
    if (ids.length === 0) return;

    const initial = products
      .filter((product) => ids.includes(product.id))
      .slice(0, MAX_COMPARE_COUNT);
    setSelectedProducts(initial);
    if (initial.length >= MIN_COMPARE_COUNT) setShowComparison(true);
    // 처음 진입할 때 한 번만 적용한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const target = comparisonRef.current;
    if (!target) return;

    const startY = window.scrollY;
    const top = target.getBoundingClientRect().top + startY - 24;
    window.scrollTo({ top, behavior: 'smooth' });

    // 브라우저 설정 등으로 smooth 스크롤이 무시되면 화면이 그대로여서
    // 버튼이 안 먹힌 것처럼 보인다. 전혀 움직이지 않았을 때만 즉시 이동으로 보정한다.
    const timer = setTimeout(() => {
      if (window.scrollY === startY) window.scrollTo(0, top);
    }, 500);
    return () => clearTimeout(timer);
  }, [showComparison]);

  const selectedIds = selectedProducts.map((product) => product.id);

  return (
    // 랭킹 페이지와 동일하게 worldcup-shell 위에 compare-shell 을 얹는다.
    <main className="worldcup-shell compare-shell">
      <SiteHeader activeMenu="compare" />

      <div
        className={`compare-content ${
          selectedProducts.length > 0 ? styles.withBar : ''
        }`}
      >
        <div className="compare-heading">
          <span className="eyebrow">BURGER PICK · BURGER COMPARE</span>
          <h1>
            같은 값이면,
            <br />
            <strong>더 나은 버거로.</strong>
          </h1>
          <p>여러 브랜드의 햄버거를 한 화면에서 찾고, 최대 4개까지 가격과 영양정보를 비교해 보세요.</p>
        </div>

        <section className={styles.filters} aria-label="검색 및 필터">
          <SearchBar value={searchKeyword} onChange={setSearchKeyword} />
          <BrandFilter brands={brands} value={selectedBrand} onChange={setSelectedBrand} />
          <PattyFilter value={selectedPattyType} onChange={setSelectedPattyType} />
        </section>

        <div className={styles.listHeader}>
          <p className={styles.count} aria-live="polite">
            햄버거 <strong>{filteredProducts.length}</strong>개
          </p>
          <ProductSort value={sortType} onChange={setSortType} />
        </div>

        {loadError && (
          <p className={styles.likeError} role="alert">
            {loadError}
          </p>
        )}

        {likeError && (
          <p className={styles.likeError} role="alert">
            {likeError}
          </p>
        )}

        <ProductGrid
          products={filteredProducts}
          selectedIds={selectedIds}
          onToggleCompare={toggleCompare}
          onResetFilters={resetFilters}
          likeCounts={likeCounts}
          likedIds={likedIds}
          pendingLikeIds={pendingLikeIds}
          onToggleLike={toggleLike}
          reviewsSummary={reviewsSummary}
          onOpenReviews={(p) => openReviewsForProduct(p.id)}
        />

        {showComparison && selectedProducts.length >= MIN_COMPARE_COUNT && (
          <section className={styles.comparison} ref={comparisonRef} aria-label="햄버거 비교">
            <div className={styles.comparisonHeader}>
              <h2 className={styles.comparisonTitle}>
                햄버거 비교
                <small>선택한 {selectedProducts.length}개 · 가격은 단품 기준</small>
              </h2>
              <button
                type="button"
                className={styles.closeButton}
                onClick={() => setShowComparison(false)}
              >
                닫기
              </button>
            </div>
            <CompareTable
              products={selectedProducts}
              reviewsSummary={reviewsSummary}
              onOpenReviews={(p) => openReviewsForProduct(p.id)}
            />
          </section>
        )}
      </div>

      {selectedProducts.length > 0 && (
        <CompareBar
          selectedProducts={selectedProducts}
          onRemove={removeFromCompare}
          onReset={resetCompare}
          onCompare={() => setShowComparison(true)}
          notice={notice}
        />
      )}

      {activeReviewProduct && (
        <ReviewModal
          product={activeReviewProduct}
          summary={activeSummary}
          reviews={activeReviews}
          isLoading={isLoadingReviews}
          onClose={closeReviews}
          onSubmit={async (input) => {
            await submitReview(activeReviewProduct.id, input);
          }}
          onDelete={async (reviewId) => {
            await deleteReview(reviewId, activeReviewProduct.id);
          }}
        />
      )}

      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>가격은 매장과 시점에 따라 다를 수 있습니다.</span>
      </footer>
    </main>
  );
}

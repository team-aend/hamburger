'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  ProductReview,
  ReviewSummaryItem,
  ReviewsSummaryMap,
} from '@/types/review';

export function useProductReviews(productIds: number[]) {
  const [summaries, setSummaries] = useState<ReviewsSummaryMap>({});
  const [activeProductId, setActiveProductId] = useState<number | null>(null);
  const [activeReviews, setActiveReviews] = useState<ProductReview[]>([]);
  const [activeSummary, setActiveSummary] = useState<ReviewSummaryItem | null>(null);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const idsKey = [...productIds].sort((a, b) => a - b).join(',');

  // 상품 목록용 평점 및 리뷰 개수 요약 배치 조회
  const fetchSummaries = useCallback(() => {
    if (idsKey === '') return;
    const controller = new AbortController();

    fetch(`/api/reviews/summary?productIds=${idsKey}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { summary: Record<string, ReviewSummaryItem> }) => {
        const mapped: ReviewsSummaryMap = {};
        for (const [idStr, item] of Object.entries(data.summary ?? {})) {
          mapped[Number(idStr)] = item;
        }
        setSummaries(mapped);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // 실패 시 조용히 빈 객체 유지
      });

    return () => controller.abort();
  }, [idsKey]);

  useEffect(() => {
    const abort = fetchSummaries();
    return () => abort?.();
  }, [fetchSummaries]);

  // 특정 상품의 한 줄 평 상세 조회
  const openReviewsForProduct = useCallback((productId: number) => {
    setActiveProductId(productId);
    setIsLoadingReviews(true);
    setError(null);

    fetch(`/api/reviews/${productId}`, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('리뷰를 불러오지 못했습니다.'))))
      .then((data: { averageRating: number; totalCount: number; reviews: ProductReview[] }) => {
        setActiveReviews(data.reviews ?? []);
        setActiveSummary({
          averageRating: data.averageRating ?? 0,
          totalCount: data.totalCount ?? 0,
        });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : '리뷰를 불러오지 못했습니다.');
      })
      .finally(() => {
        setIsLoadingReviews(false);
      });
  }, []);

  const closeReviews = useCallback(() => {
    setActiveProductId(null);
    setActiveReviews([]);
    setActiveSummary(null);
    setError(null);
  }, []);

  // 새 한 줄 평 작성
  const submitReview = useCallback(
    async (
      productId: number,
      input: { rating: number; content: string; authorName?: string }
    ) => {
      setError(null);
      const res = await fetch(`/api/reviews/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || '리뷰 등록에 실패했습니다.');
      }

      // 작성 성공 시 상세 리뷰 목록 및 전체 요약 갱신
      if (data.review) {
        setActiveReviews((prev) => [data.review, ...prev]);
        setActiveSummary((prev) => {
          const prevCount = prev?.totalCount ?? 0;
          const prevAvg = prev?.averageRating ?? 0;
          const nextCount = prevCount + 1;
          const nextAvg = Number(
            ((prevAvg * prevCount + data.review.rating) / nextCount).toFixed(1)
          );
          return { averageRating: nextAvg, totalCount: nextCount };
        });
        setSummaries((prev) => {
          const current = prev[productId] ?? { averageRating: 0, totalCount: 0 };
          const nextCount = current.totalCount + 1;
          const nextAvg = Number(
            ((current.averageRating * current.totalCount + data.review.rating) / nextCount).toFixed(1)
          );
          return {
            ...prev,
            [productId]: { averageRating: nextAvg, totalCount: nextCount },
          };
        });
      }
      return data.review;
    },
    []
  );

  // 작성자 본인 리뷰 삭제
  const deleteReview = useCallback(
    async (reviewId: number, productId: number) => {
      const res = await fetch(`/api/reviews/${reviewId}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || '리뷰 삭제에 실패했습니다.');
      }

      // 삭제 후 UI 즉시 반영
      setActiveReviews((prev) => prev.filter((r) => r.id !== reviewId));
      openReviewsForProduct(productId);
      fetchSummaries();
    },
    [openReviewsForProduct, fetchSummaries]
  );

  return {
    summaries,
    activeProductId,
    activeReviews,
    activeSummary,
    isLoadingReviews,
    error,
    openReviewsForProduct,
    closeReviews,
    submitReview,
    deleteReview,
  };
}

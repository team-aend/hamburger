'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';

/**
 * 상품 좋아요 수 / 내 좋아요 상태를 불러오고 토글한다. (좋아요는 로그인 필수)
 * - 비로그인 사용자가 누르면 로그인 화면으로 이동했다가 현재 화면으로 돌아온다.
 * - 누르는 즉시 화면에 반영하고(낙관적 업데이트), 서버 저장에 실패하면 되돌린다.
 */
export function useProductLikes(productIds: number[]) {
  const { user, loading: authLoading, goToLogin } = useAuth();
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const [pendingIds, setPendingIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const likedRef = useRef(likedIds);
  likedRef.current = likedIds;

  const idsKey = [...productIds].sort((a, b) => a - b).join(',');

  // 로그인 상태가 바뀌면(로그인/로그아웃) 내 좋아요 상태도 다시 불러온다.
  useEffect(() => {
    if (authLoading || idsKey === '') return;
    const controller = new AbortController();

    fetch(`/api/likes?productIds=${idsKey}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error())))
      .then((data: { counts: Record<string, number>; likedProductIds: number[] }) => {
        setCounts(
          Object.fromEntries(Object.entries(data.counts).map(([id, n]) => [Number(id), n]))
        );
        setLikedIds(new Set(data.likedProductIds));
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // 좋아요 수를 못 불러와도 비교 기능은 그대로 쓸 수 있게 조용히 0으로 둔다.
        setCounts({});
        setLikedIds(new Set());
      });

    return () => controller.abort();
  }, [idsKey, user?.id, authLoading]);

  // 안내 메시지는 잠시 후 자동으로 사라진다.
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(null), 2500);
    return () => clearTimeout(timer);
  }, [error]);

  const toggleLike = useCallback(
    async (productId: number) => {
      if (!user) {
        goToLogin();
        return;
      }
      if (pendingIds.has(productId)) return;

      const nextLiked = !likedRef.current.has(productId);
      const applyLocal = (liked: boolean) => {
        setLikedIds((prev) => {
          const next = new Set(prev);
          if (liked) next.add(productId);
          else next.delete(productId);
          return next;
        });
        setCounts((prev) => ({
          ...prev,
          [productId]: Math.max(0, (prev[productId] ?? 0) + (liked ? 1 : -1)),
        }));
      };

      applyLocal(nextLiked);
      setPendingIds((prev) => new Set(prev).add(productId));

      try {
        const res = await fetch(`/api/likes/${productId}`, {
          method: nextLiked ? 'PUT' : 'DELETE',
        });
        if (res.status === 401) {
          applyLocal(!nextLiked);
          goToLogin();
          return;
        }
        if (!res.ok) throw new Error();
        const data: { liked: boolean; count: number } = await res.json();
        // 다른 사용자의 좋아요까지 반영된 서버 값으로 맞춘다.
        setCounts((prev) => ({ ...prev, [productId]: data.count }));
      } catch {
        applyLocal(!nextLiked);
        setError('좋아요를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
      } finally {
        setPendingIds((prev) => {
          const next = new Set(prev);
          next.delete(productId);
          return next;
        });
      }
    },
    [user, goToLogin, pendingIds]
  );

  return { counts, likedIds, pendingIds, toggleLike, error };
}

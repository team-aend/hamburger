'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/components/auth/AuthProvider';
import SiteHeader from '@/components/SiteHeader';
import { useProductLikes } from '@/hooks/useProductLikes';
import type { ProductDetail } from '@/types/productDetail';
import type { ProductReview } from '@/types/review';
import PriceHistoryChart from './PriceHistoryChart';

const INGREDIENT_GROUP_LABEL: Record<string, string> = {
  PATTY: '패티',
  TOPPING: '토핑',
  CHEESE_SAUCE: '치즈·소스',
};

const won = (value: number | null) => (value === null ? '-' : `${value.toLocaleString('ko-KR')}원`);
const longDate = (iso: string) =>
  new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

export default function ProductDetailView({ product }: { product: ProductDetail }) {
  // 좋아요 API 는 숫자 ID 를 쓴다 (상세 API 는 BIGINT 를 문자열로 보존)
  const likeId = Number(product.productId);
  const [variantId, setVariantId] = useState(product.variants[0]?.variantId ?? null);
  const variant = product.variants.find((v) => v.variantId === variantId) ?? product.variants[0];
  const variantHistory = product.priceHistory.filter((row) => row.variantId === variant?.variantId);
  // 채널마다 기록이 하나뿐이면 가격이 바뀐 적이 없다 → 그래프 대신 문장으로 보여준다.
  const hasPriceChanges =
    variantHistory.length > new Set(variantHistory.map((row) => row.channel)).size;
  const since = variantHistory.length
    ? variantHistory.reduce((a, b) => (a.startedAt < b.startedAt ? a : b)).startedAt
    : null;

  const { counts, likedIds, pendingIds, toggleLike, error: likeError } = useProductLikes([likeId]);
  const likeCount = counts[likeId] ?? product.likes.count;
  const liked = likedIds.has(likeId);

  const store = variant?.prices.store ?? null;
  const delivery = variant?.prices.delivery ?? null;
  const nutrition = variant?.nutrition ?? null;
  // 단백질 가성비: 1,000원당 단백질 (햄버거 비교 화면의 "단성비"와 같은 개념)
  const proteinPer1000 =
    nutrition?.proteinG && store ? Math.round((nutrition.proteinG / store) * 1000 * 10) / 10 : null;

  const groupedIngredients = Object.entries(
    product.ingredients.reduce<Record<string, string[]>>((acc, ing) => {
      (acc[ing.group] ??= []).push(ing.name);
      return acc;
    }, {})
  );

  const { worldcup } = product;
  const winRate = worldcup.matches > 0 ? Math.round((worldcup.wins / worldcup.matches) * 1000) / 10 : null;

  return (
    <main className="worldcup-shell pd-shell">
      <SiteHeader activeMenu="recommend" />

      <div className="pd-content">
        <nav className="pd-breadcrumb" aria-label="위치">
          <Link href="/recommend">버거 검색</Link>
          <span aria-hidden="true">/</span>
          <span>{product.brand.name}</span>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{product.name}</span>
        </nav>

        {/* ── 상단 요약 ── */}
        <section className="pd-hero" aria-labelledby="pd-title">
          <div className="pd-visual">
            {product.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.imageUrl} alt={product.name} />
            ) : (
              <span className="pd-visual-placeholder" aria-hidden="true">🍔</span>
            )}
            <div className="pd-badges">
              {product.status !== 'ACTIVE' && <span className="pd-badge muted">판매 종료</span>}
              {product.isLimited && <span className="pd-badge">한정 메뉴</span>}
            </div>
          </div>

          <div className="pd-summary">
            <span className="eyebrow">{product.brand.name} · {product.category}</span>
            <h1 id="pd-title">{product.name}</h1>
            {product.description && <p className="pd-description">{product.description}</p>}
            {product.tags.length > 0 && (
              <ul className="pd-tags" aria-label="태그">
                {product.tags.map((tag) => <li key={tag.slug}>#{tag.name}</li>)}
              </ul>
            )}

            <dl className="pd-quick">
              <div>
                <dt>단품 매장가</dt>
                <dd>{won(product.variants.find((v) => v.variantType === 'SINGLE')?.prices.store ?? store)}</dd>
              </div>
              <div>
                <dt>평점</dt>
                <dd>
                  <a href="#reviews">
                    {product.reviews.totalCount > 0
                      ? `★ ${product.reviews.averageRating.toFixed(1)} (${product.reviews.totalCount})`
                      : '리뷰 없음'}
                  </a>
                </dd>
              </div>
              <div>
                <dt>월드컵 우승</dt>
                <dd>
                  <a href="#worldcup">{worldcup.championships}회</a>
                </dd>
              </div>
            </dl>

            <div className="pd-actions">
              <button
                type="button"
                className={`pd-like ${liked ? 'liked' : ''}`}
                aria-pressed={liked}
                disabled={pendingIds.has(likeId)}
                onClick={() => toggleLike(likeId)}
              >
                <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
                {liked ? '좋아요 취소' : '좋아요'}
                <b>{likeCount}</b>
              </button>
              <p className="pd-like-help">좋아요하면 가격이 바뀔 때 마이페이지에서 알려드려요.</p>
            </div>
            {likeError && <p className="pd-error" role="alert">{likeError}</p>}
          </div>
        </section>

        {/* ── 가격 ── */}
        <section className="pd-section" aria-labelledby="pd-price-title">
          <div className="pd-section-head">
            <h2 id="pd-price-title">가격</h2>
            {product.variants.length > 1 && (
              <div className="pd-segment" role="group" aria-label="판매 형태">
                {product.variants.map((v) => (
                  <button
                    key={v.variantId}
                    type="button"
                    aria-pressed={v.variantId === variant?.variantId}
                    className={v.variantId === variant?.variantId ? 'selected' : ''}
                    onClick={() => setVariantId(v.variantId)}
                  >
                    {v.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="pd-price-grid">
            <div className="pd-price-tile primary">
              <span>{variant?.name} 매장가</span>
              <strong>{won(store)}</strong>
            </div>
            <div className="pd-price-tile">
              <span>{variant?.name} 배달가</span>
              <strong>{won(delivery)}</strong>
              {store !== null && delivery !== null && delivery !== store && (
                <small>매장가보다 {delivery > store ? '+' : '−'}{won(Math.abs(delivery - store))}</small>
              )}
            </div>
          </div>

          {hasPriceChanges ? (
            <PriceHistoryChart rows={variantHistory} title={`${variant?.name} 가격 추이`} />
          ) : (
            <p className="pd-empty-note">
              가격 변동 기록이 아직 없어요.{since && ` ${longDate(since)}부터 같은 가격이에요.`}
            </p>
          )}
        </section>

        {/* ── 영양 정보 ── */}
        <section className="pd-section" aria-labelledby="pd-nutrition-title">
          <div className="pd-section-head">
            <h2 id="pd-nutrition-title">영양 정보</h2>
            <small>{variant?.name} 기준</small>
          </div>
          {nutrition ? (
            <dl className="pd-stat-grid">
              <Stat label="열량" value={nutrition.caloriesKcal} unit="kcal" />
              <Stat label="단백질" value={nutrition.proteinG} unit="g" />
              <Stat label="당류" value={nutrition.sugarG} unit="g" />
              <Stat label="포화지방" value={nutrition.saturatedFatG} unit="g" />
              <Stat label="나트륨" value={nutrition.sodiumMg} unit="mg" />
              <Stat label="중량" value={nutrition.servingSizeG} unit="g" />
              <Stat label="1,000원당 단백질" value={proteinPer1000} unit="g" highlight />
            </dl>
          ) : (
            <p className="pd-empty-note">영양 정보가 아직 등록되지 않았어요.</p>
          )}
        </section>

        {/* ── 재료 ── */}
        {groupedIngredients.length > 0 && (
          <section className="pd-section" aria-labelledby="pd-ingredients-title">
            <div className="pd-section-head">
              <h2 id="pd-ingredients-title">들어간 재료</h2>
            </div>
            <div className="pd-ingredients">
              {groupedIngredients.map(([group, names]) => (
                <div key={group}>
                  <span>{INGREDIENT_GROUP_LABEL[group] ?? group}</span>
                  <ul>
                    {names.map((name) => <li key={name}>{name}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 월드컵 성적 ── */}
        <section className="pd-section" id="worldcup" aria-labelledby="pd-worldcup-title">
          <div className="pd-section-head">
            <h2 id="pd-worldcup-title">월드컵 성적</h2>
            <Link href="/ranking">전체 랭킹 →</Link>
          </div>
          {worldcup.appearances > 0 ? (
            <dl className="pd-stat-grid">
              <Stat label="우승" value={worldcup.championships} unit="회" />
              <Stat label="우승 랭킹" value={worldcup.rank} unit="위" emptyText="기록 없음" />
              <Stat label="출전" value={worldcup.appearances} unit="회" />
              <Stat label="대결 승률" value={winRate} unit="%" emptyText="-" />
            </dl>
          ) : (
            <p className="pd-empty-note">
              아직 월드컵에 나온 적이 없어요. <Link href="/">월드컵 하러 가기 →</Link>
            </p>
          )}
        </section>

        {/* ── 한 줄 평 ── */}
        <ReviewsSection productId={likeId} />

        {/* ── 비슷한 버거 ── */}
        {product.similar.length > 0 && (
          <section className="pd-section" aria-labelledby="pd-similar-title">
            <div className="pd-section-head">
              <h2 id="pd-similar-title">비슷한 버거</h2>
            </div>
            <ul className="pd-similar">
              {product.similar.map((item) => (
                <li key={item.productId}>
                  <Link href={`/products/${item.productId}`}>
                    <small>{item.brandName}</small>
                    <strong>{item.name}</strong>
                    <span className="pd-similar-price">{won(item.singlePrice)}</span>
                    <span className="pd-similar-meta">
                      {item.caloriesKcal ? `${item.caloriesKcal}kcal · ` : ''}
                      {item.reason}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>가격은 매장과 시점에 따라 다를 수 있습니다.</span>
      </footer>
    </main>
  );
}

function Stat({
  label,
  value,
  unit,
  highlight = false,
  emptyText = '-',
}: {
  label: string;
  value: number | null;
  unit: string;
  highlight?: boolean;
  emptyText?: string;
}) {
  return (
    <div className={highlight ? 'highlight' : undefined}>
      <dt>{label}</dt>
      <dd>
        {value === null ? emptyText : (
          <>
            {value.toLocaleString('ko-KR')}
            <small>{unit}</small>
          </>
        )}
      </dd>
    </div>
  );
}

// ── 한 줄 평 (햄버거 비교 화면의 리뷰 모달과 같은 API: /api/reviews) ──

function ReviewsSection({ productId }: { productId: number }) {
  const { user, goToLogin } = useAuth();
  const [data, setData] = useState<{ averageRating: number; totalCount: number; reviews: ProductReview[] } | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rating, setRating] = useState(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/reviews/${productId}`, { cache: 'no-store' });
      if (!res.ok) throw new Error();
      setData(await res.json());
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [productId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) {
      goToLogin();
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch(`/api/reviews/${productId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating, content: content.trim() }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message);
      setContent('');
      await load();
    } catch (error) {
      setFormError(error instanceof Error && error.message ? error.message : '한 줄 평을 등록하지 못했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (reviewId: number) => {
    const res = await fetch(`/api/reviews/${reviewId}`, { method: 'DELETE' });
    if (res.ok) await load();
    else setFormError('한 줄 평을 삭제하지 못했어요.');
  };

  return (
    <section className="pd-section" id="reviews" aria-labelledby="pd-reviews-title">
      <div className="pd-section-head">
        <h2 id="pd-reviews-title">한 줄 평</h2>
        {data && data.totalCount > 0 && (
          <small>
            ★ {data.averageRating.toFixed(1)} · {data.totalCount}개
          </small>
        )}
      </div>

      {user ? (
        <form className="pd-review-form" onSubmit={submit}>
          <div className="pd-stars" role="radiogroup" aria-label="별점">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                role="radio"
                aria-checked={rating === star}
                aria-label={`${star}점`}
                className={star <= rating ? 'on' : ''}
                onClick={() => setRating(star)}
              >
                ★
              </button>
            ))}
            <span>{rating}점</span>
          </div>
          <div className="pd-review-input">
            <input
              type="text"
              value={content}
              maxLength={200}
              onChange={(e) => setContent(e.target.value)}
              placeholder="맛, 패티, 양은 어땠나요? (최대 200자)"
              aria-label="한 줄 평"
            />
            <button type="submit" disabled={submitting || content.trim() === ''}>
              {submitting ? '등록 중...' : '등록'}
            </button>
          </div>
          {formError && <p className="pd-error" role="alert">{formError}</p>}
        </form>
      ) : (
        <p className="pd-empty-note">
          한 줄 평은 로그인 후 남길 수 있어요.{' '}
          <button type="button" className="pd-link-button" onClick={() => goToLogin()}>
            로그인하기 →
          </button>
        </p>
      )}

      {loadError ? (
        <p className="pd-error" role="alert">한 줄 평을 불러오지 못했어요.</p>
      ) : !data ? (
        <p className="pd-empty-note">불러오는 중...</p>
      ) : data.reviews.length === 0 ? (
        <p className="pd-empty-note">아직 한 줄 평이 없어요. 첫 번째로 남겨보세요!</p>
      ) : (
        <ul className="pd-reviews">
          {data.reviews.map((review) => (
            <li key={review.id}>
              <div className="pd-review-meta">
                <span className="pd-review-stars" aria-label={`${review.rating}점`}>
                  {'★'.repeat(review.rating)}
                  <span aria-hidden="true">{'★'.repeat(5 - review.rating)}</span>
                </span>
                <strong>{review.authorName}</strong>
                <time dateTime={review.createdAt}>{longDate(review.createdAt)}</time>
                {user && user.id === review.userId && (
                  <button type="button" className="pd-link-button" onClick={() => void remove(review.id)}>
                    삭제
                  </button>
                )}
              </div>
              <p>{review.content}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

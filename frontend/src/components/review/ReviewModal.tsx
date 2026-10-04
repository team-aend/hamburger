'use client';

import { useEffect, useState } from 'react';
import type { Product } from '@/types/product';
import type { ProductReview, ReviewSummaryItem } from '@/types/review';
import { useAuth } from '@/components/auth/AuthProvider';
import styles from './ReviewModal.module.css';

interface ReviewModalProps {
  product: Product;
  summary: ReviewSummaryItem | null;
  reviews: ProductReview[];
  isLoading: boolean;
  onClose: () => void;
  onSubmit: (input: { rating: number; content: string; authorName?: string }) => Promise<void>;
  onDelete: (reviewId: number) => Promise<void>;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    if (diffMins < 1) return '방금 전';
    if (diffMins < 60) return `${diffMins}분 전`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}시간 전`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export default function ReviewModal({
  product,
  summary,
  reviews,
  isLoading,
  onClose,
  onSubmit,
  onDelete,
}: ReviewModalProps) {
  const { user, goToLogin } = useAuth();
  const [rating, setRating] = useState<number>(5);
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // ESC 키로 닫기
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      goToLogin();
      return;
    }
    if (content.trim().length === 0) {
      setFormError('한 줄 평 내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setFormError(null);
    try {
      await onSubmit({
        rating,
        content: content.trim(),
      });
      setContent('');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : '등록에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const avg = summary?.averageRating ?? 0;
  const count = summary?.totalCount ?? reviews.length;

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="review-modal-title"
    >
      <div className={styles.modal}>
        {/* 헤더 */}
        <div className={styles.header}>
          <div className={styles.productInfo}>
            <div className={styles.thumb}>
              {product.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className={styles.thumbImg}
                />
              ) : (
                <span>🍔</span>
              )}
            </div>
            <div className={styles.titleGroup}>
              <span className={styles.brand}>{product.brand.name}</span>
              <h2 id="review-modal-title" className={styles.name}>
                {product.name} 한 줄 평
              </h2>
            </div>
          </div>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* 본문 */}
        <div className={styles.content}>
          {/* 평점 요약 */}
          <div className={styles.summaryBox}>
            <div className={styles.summaryScore}>
              <span className={styles.scoreNumber}>
                ★ {avg > 0 ? avg.toFixed(1) : '-'}
              </span>
              <span className={styles.scoreMax}>/ 5.0</span>
            </div>
            <span className={styles.summaryCount}>
              총 <strong>{count}</strong>개의 한 줄 평
            </span>
          </div>

          {/* 한 줄 평 작성 폼 (로그인 필수) */}
          {user ? (
            <form className={styles.formSection} onSubmit={handleSubmit}>
              <h3 className={styles.formTitle}>한 줄 평 남기기</h3>

              {/* 별점 선택 */}
              <div className={styles.ratingPicker} role="radiogroup" aria-label="별점 선택">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    className={`${styles.starButton} ${
                      star <= rating ? styles.starActive : ''
                    }`}
                    onClick={() => setRating(star)}
                    aria-label={`${star}점`}
                  >
                    ★
                  </button>
                ))}
                <span style={{ fontSize: '0.85rem', fontWeight: 700, marginLeft: '0.3rem' }}>
                  {rating}점
                </span>
              </div>

              {/* 작성자 정보 */}
              <div className={styles.authorRow}>
                <span className={styles.authorLabel}>작성자:</span>
                <span className={styles.loggedInBadge}>
                  {user.displayName} (회원)
                </span>
              </div>

              {/* 내용 입력 */}
              <textarea
                className={styles.textarea}
                placeholder="이 버거의 맛, 패티, 양은 어떤가요? 한 줄 평을 남겨보세요! (최대 200자)"
                value={content}
                maxLength={200}
                onChange={(e) => setContent(e.target.value)}
                rows={3}
              />

              {formError && <div className={styles.errorMessage}>{formError}</div>}

              <div className={styles.formFooter}>
                <span className={styles.charCount}>{content.length} / 200자</span>
                <button
                  type="submit"
                  className={styles.submitButton}
                  disabled={submitting || content.trim().length === 0}
                >
                  {submitting ? '등록 중...' : '한 줄 평 등록'}
                </button>
              </div>
            </form>
          ) : (
            <div className={styles.loginRequiredBox}>
              <div className={styles.loginRequiredIcon} aria-hidden="true">
                🔒
              </div>
              <div className={styles.loginRequiredText}>
                <strong>한 줄 평은 로그인 후 작성할 수 있습니다</strong>
                <p>무분별한 악성 댓글과 도배를 방지하기 위해 로그인 회원만 작성할 수 있어요.</p>
              </div>
              <button
                type="button"
                className={styles.loginButton}
                onClick={() => goToLogin()}
              >
                로그인하고 한 줄 평 남기기 →
              </button>
            </div>
          )}

          {/* 한 줄 평 목록 */}
          <div className={styles.reviewList}>
            <span className={styles.listHeader}>최근 한 줄 평</span>

            {isLoading ? (
              <div className={styles.emptyReviews}>한 줄 평을 불러오는 중...</div>
            ) : reviews.length === 0 ? (
              <div className={styles.emptyReviews}>
                아직 등록된 한 줄 평이 없어요. 첫 번째 한 줄 평을 남겨보세요!
              </div>
            ) : (
              reviews.map((rev) => (
                <div key={rev.id} className={styles.reviewCard}>
                  <div className={styles.reviewCardTop}>
                    <div className={styles.reviewMeta}>
                      <span className={styles.reviewStars}>
                        {'★'.repeat(rev.rating)}
                        {'☆'.repeat(5 - rev.rating)}
                      </span>
                      <span className={styles.reviewAuthor}>{rev.authorName}</span>
                      <span className={styles.reviewDate}>
                        {formatDate(rev.createdAt)}
                      </span>
                    </div>
                    {user && user.id === rev.userId && (
                      <button
                        type="button"
                        className={styles.deleteButton}
                        onClick={() => onDelete(rev.id)}
                        aria-label="리뷰 삭제"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                  <p className={styles.reviewContent}>{rev.content}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

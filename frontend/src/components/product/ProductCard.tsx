import {
  formatCalories,
  formatPrice,
  formatProtein,
  formatProteinEfficiency,
  formatProteinPerThousand,
} from '@/lib/format';
import { PATTY_TYPE_LABEL, type Product } from '@/types/product';
import type { ReviewSummaryItem } from '@/types/review';
import BurgerImage from './BurgerImage';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  selected: boolean;
  onToggleCompare: (product: Product) => void;
  liked: boolean;
  likeCount: number;
  likePending: boolean;
  onToggleLike: (productId: number) => void;
  reviewSummary?: ReviewSummaryItem;
  onOpenReviews?: (product: Product) => void;
}

export default function ProductCard({
  product,
  selected,
  onToggleCompare,
  liked,
  likeCount,
  likePending,
  onToggleLike,
  reviewSummary,
  onOpenReviews,
}: ProductCardProps) {
  return (
    <article className={`${styles.card} ${selected ? styles.cardSelected : ''}`}>
      <div className={styles.thumb}>
        <BurgerImage
          src={product.imageUrl}
          alt={product.name}
          className={styles.image}
          fallback={
            <div className={styles.placeholder}>
              <span className={styles.placeholderIcon} aria-hidden>🍔</span>
              <span className={styles.placeholderText}>이미지 준비중</span>
            </div>
          }
        />

        {/* 좋아요 (로그인 필수: 비로그인이면 로그인 화면으로 이동) */}
        <button
          type="button"
          aria-pressed={liked}
          aria-label={`${product.name} 좋아요${liked ? ' 취소' : ''}, 현재 ${likeCount}개`}
          className={`${styles.likeButton} ${liked ? styles.likeButtonActive : ''}`}
          disabled={likePending}
          onClick={() => onToggleLike(product.id)}
        >
          <span aria-hidden="true">{liked ? '♥' : '♡'}</span>
          <span>{likeCount}</span>
        </button>
      </div>

      <div className={styles.body}>
        <p className={styles.brand}>{product.brand.name}</p>
        <h3 className={styles.name}>{product.name}</h3>

        <div className={styles.metaRow}>
          <span className={styles.patty}>{PATTY_TYPE_LABEL[product.pattyType]}</span>

          {/* 한 줄 평 보기 / 작성 버튼 */}
          <button
            type="button"
            className={styles.reviewTrigger}
            onClick={() => onOpenReviews?.(product)}
            aria-label={`${product.name} 한 줄 평 보기`}
          >
            <span className={styles.reviewTriggerStar} aria-hidden="true">
              ★
            </span>
            <span>
              {reviewSummary && reviewSummary.averageRating > 0
                ? reviewSummary.averageRating.toFixed(1)
                : '-'}
            </span>
            <span>({reviewSummary?.totalCount ?? 0})</span>
          </button>
        </div>

        <dl className={styles.prices}>
          <div className={styles.priceRow}>
            <dt>단품</dt>
            <dd className={styles.singlePrice}>{formatPrice(product.singlePrice)}</dd>
          </div>
          <div className={styles.priceRow}>
            <dt>세트</dt>
            <dd className={styles.setPrice}>{formatPrice(product.setPrice)}</dd>
          </div>
        </dl>

        <p className={styles.nutrition}>
          {formatCalories(product.calories)} · 단백질 {formatProtein(product.protein)}
        </p>

        {formatProteinPerThousand(product.protein, product.singlePrice) && (
          <span
            className={styles.proteinBadge}
            title={formatProteinEfficiency(product.protein, product.singlePrice)}
          >
            ⚡ {formatProteinPerThousand(product.protein, product.singlePrice)}
          </span>
        )}
      </div>

      <button
        type="button"
        aria-pressed={selected}
        className={`${styles.compareButton} ${selected ? styles.compareButtonSelected : ''}`}
        onClick={() => onToggleCompare(product)}
      >
        {selected ? '✓ 비교중' : '+ 비교하기'}
      </button>
    </article>
  );
}

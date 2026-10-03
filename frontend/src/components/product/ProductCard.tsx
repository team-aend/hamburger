import { formatCalories, formatPrice, formatProtein } from '@/lib/format';
import { PATTY_TYPE_LABEL, type Product } from '@/types/product';
import styles from './ProductCard.module.css';

interface ProductCardProps {
  product: Product;
  selected: boolean;
  onToggleCompare: (product: Product) => void;
  liked: boolean;
  likeCount: number;
  likePending: boolean;
  onToggleLike: (productId: number) => void;
}

export default function ProductCard({
  product,
  selected,
  onToggleCompare,
  liked,
  likeCount,
  likePending,
  onToggleLike,
}: ProductCardProps) {
  return (
    <article className={`${styles.card} ${selected ? styles.cardSelected : ''}`}>
      <div className={styles.thumb}>
        {product.imageUrl ? (
          // 실제 이미지가 준비되면 imageUrl 값만 채우면 된다.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={product.imageUrl} alt={product.name} className={styles.image} />
        ) : (
          <div className={styles.placeholder}>
            <span className={styles.placeholderIcon} aria-hidden>
              🍔
            </span>
            <span className={styles.placeholderText}>이미지 준비중</span>
          </div>
        )}

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
        <span className={styles.patty}>{PATTY_TYPE_LABEL[product.pattyType]}</span>

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

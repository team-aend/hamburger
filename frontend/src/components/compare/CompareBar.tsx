import { MAX_COMPARE_COUNT, MIN_COMPARE_COUNT, type Product } from '@/types/product';
import styles from './CompareBar.module.css';

interface CompareBarProps {
  selectedProducts: Product[];
  onRemove: (productId: number) => void;
  onReset: () => void;
  onCompare: () => void;
  notice: string | null;
}

export default function CompareBar({
  selectedProducts,
  onRemove,
  onReset,
  onCompare,
  notice,
}: CompareBarProps) {
  const canCompare = selectedProducts.length >= MIN_COMPARE_COUNT;

  return (
    <div className={styles.bar}>
      <div className={styles.inner}>
        {notice && <p className={styles.notice}>{notice}</p>}

        <div className={styles.content}>
          <div className={styles.selection}>
            <span className={styles.label}>비교할 메뉴</span>
            <div className={`${styles.chips} scroll-x`}>
              {selectedProducts.map((product) => (
                <span key={product.id} className={styles.chip}>
                  {product.name}
                  <button
                    type="button"
                    className={styles.chipRemove}
                    onClick={() => onRemove(product.id)}
                    aria-label={`${product.name} 비교에서 제거`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <span className={styles.count}>
              {selectedProducts.length} / {MAX_COMPARE_COUNT}
            </span>
          </div>

          <div className={styles.actions}>
            <button type="button" className={styles.resetButton} onClick={onReset}>
              선택 초기화
            </button>
            <button
              type="button"
              className={styles.compareButton}
              onClick={onCompare}
              disabled={!canCompare}
            >
              비교하기
            </button>
          </div>
        </div>

        {!canCompare && (
          <p className={styles.hint}>
            비교하려면 메뉴를 {MIN_COMPARE_COUNT}개 이상 선택해주세요.
          </p>
        )}
      </div>
    </div>
  );
}

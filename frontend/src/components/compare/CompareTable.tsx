import {
  calcProteinPerPrice,
  formatCalories,
  formatPrice,
  formatProtein,
} from '@/lib/format';
import { PATTY_TYPE_LABEL, type Product } from '@/types/product';
import type { ReviewsSummaryMap } from '@/types/review';
import BurgerImage from '@/components/product/BurgerImage';
import styles from './CompareTable.module.css';

interface CompareTableProps {
  products: Product[];
  reviewsSummary?: ReviewsSummaryMap;
  onOpenReviews?: (product: Product) => void;
}

export default function CompareTable({
  products,
  reviewsSummary,
  onOpenReviews,
}: CompareTableProps) {
  const lowestSinglePrice = Math.min(...products.map((p) => p.singlePrice));
  const efficiencies = products.map((p) =>
    calcProteinPerPrice(p.protein, p.singlePrice)
  );
  const validEfficiencies = efficiencies.filter(
    (eff): eff is number => eff !== null
  );
  const maxEfficiency =
    validEfficiencies.length > 0 ? Math.max(...validEfficiencies) : null;

  return (
    <div className={styles.scroller}>
      <table className={styles.table}>
        <caption className={styles.caption}>선택한 메뉴의 가격과 영양정보 비교</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.rowHeader}>
              메뉴명
            </th>
            {products.map((product) => (
              <th key={product.id} scope="col" className={styles.productHeader}>
                {product.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className={styles.rowHeader}>
              브랜드
            </th>
            {products.map((product) => (
              <td key={product.id}>{product.brand.name}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHeader}>
              이미지
            </th>
            {products.map((product) => (
              <td key={product.id}>
                <div className={styles.thumb}>
                  <BurgerImage
                    src={product.imageUrl}
                    alt={product.name}
                    className={styles.image}
                    fallback={<span className={styles.placeholder} aria-label="이미지 준비중">🍔</span>}
                  />
                </div>
              </td>
            ))}
          </tr>
          <tr className={styles.priceRow}>
            <th scope="row" className={styles.rowHeader}>
              단품 가격
            </th>
            {products.map((product) => (
              <td key={product.id}>
                <span className={styles.price}>{formatPrice(product.singlePrice)}</span>
                {product.singlePrice === lowestSinglePrice && products.length > 1 && (
                  <span className={styles.badge}>최저가</span>
                )}
              </td>
            ))}
          </tr>
          <tr className={styles.priceRow}>
            <th scope="row" className={styles.rowHeader}>
              세트 가격
            </th>
            {products.map((product) => (
              <td key={product.id}>
                <span className={styles.price}>{formatPrice(product.setPrice)}</span>
              </td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHeader}>
              종류
            </th>
            {products.map((product) => (
              <td key={product.id}>{PATTY_TYPE_LABEL[product.pattyType]}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHeader}>
              칼로리
            </th>
            {products.map((product) => (
              <td key={product.id}>{formatCalories(product.calories)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHeader}>
              단백질
            </th>
            {products.map((product) => (
              <td key={product.id}>{formatProtein(product.protein)}</td>
            ))}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHeader}>
              단성비 (단백질 가성비)
            </th>
            {products.map((product) => {
              const eff = calcProteinPerPrice(product.protein, product.singlePrice);
              return (
                <td key={product.id}>
                  {eff !== null ? (
                    <div>
                      <strong style={{ display: 'block', fontSize: '13px' }}>
                        1,000원당 {eff.toFixed(1)}g
                      </strong>
                      <span style={{ fontSize: '11px', color: '#71717a' }}>
                        1g당 {Math.round(product.singlePrice / product.protein!)}원
                      </span>
                      {maxEfficiency !== null &&
                        eff === maxEfficiency &&
                        products.length > 1 && (
                          <div style={{ marginTop: '4px' }}>
                            <span
                              className={styles.badge}
                              style={{ background: '#059669', color: '#fff' }}
                            >
                              최고 단성비
                            </span>
                          </div>
                        )}
                    </div>
                  ) : (
                    '-'
                  )}
                </td>
              );
            })}
          </tr>
          <tr>
            <th scope="row" className={styles.rowHeader}>
              한 줄 평 & 평점
            </th>
            {products.map((product) => {
              const item = reviewsSummary?.[product.id];
              const avg = item?.averageRating ?? 0;
              const cnt = item?.totalCount ?? 0;
              return (
                <td key={product.id}>
                  <div>
                    <span style={{ color: '#d97706', fontWeight: 800 }}>
                      ★ {avg > 0 ? avg.toFixed(1) : '-'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#71717a', marginLeft: '4px' }}>
                      ({cnt})
                    </span>
                  </div>
                  {onOpenReviews && (
                    <button
                      type="button"
                      onClick={() => onOpenReviews(product)}
                      style={{
                        marginTop: '6px',
                        padding: '4px 8px',
                        fontSize: '11px',
                        fontWeight: 700,
                        border: '1.5px solid var(--ink)',
                        borderRadius: '6px',
                        background: '#fff',
                        cursor: 'pointer',
                        boxShadow: '1px 1px 0 var(--ink)',
                      }}
                    >
                      한줄평 보기 →
                    </button>
                  )}
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

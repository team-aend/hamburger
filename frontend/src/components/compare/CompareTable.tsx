import { formatCalories, formatPrice, formatProtein } from '@/lib/format';
import { PATTY_TYPE_LABEL, type Product } from '@/types/product';
import styles from './CompareTable.module.css';

interface CompareTableProps {
  products: Product[];
}

export default function CompareTable({ products }: CompareTableProps) {
  const lowestSinglePrice = Math.min(...products.map((p) => p.singlePrice));

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
                  {product.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className={styles.image}
                    />
                  ) : (
                    <span className={styles.placeholder} aria-label="이미지 준비중">
                      🍔
                    </span>
                  )}
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
        </tbody>
      </table>
    </div>
  );
}

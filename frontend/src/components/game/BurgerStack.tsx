import { INGREDIENTS } from '@/data/burgerGame';
import type { IngredientType } from '@/types/burgerGame';
import IngredientLayer from './IngredientLayer';
import styles from './BurgerStack.module.css';

interface BurgerStackProps {
  /** 첫 번째 요소가 가장 아래층이다. */
  ingredients: IngredientType[];
  size?: 'large' | 'small';
  /** 새로 올린 층에 떨어지는 애니메이션을 줄지 */
  animate?: boolean;
  label: string;
  emptyText?: string;
}

export default function BurgerStack({
  ingredients,
  size = 'large',
  animate = false,
  label,
  emptyText,
}: BurgerStackProps) {
  const description = ingredients.length
    ? `${label}: 아래부터 ${ingredients.map((type) => INGREDIENTS[type].name).join(', ')}`
    : `${label}: 비어 있음`;

  return (
    <div className={`${styles.stage} ${styles[size]}`} role="img" aria-label={description}>
      <div className={styles.stack}>
        {ingredients.map((type, index) => (
          // 층은 위에만 추가/제거되므로 index 를 key 로 써도 기존 층이 다시 그려지지 않는다.
          <IngredientLayer key={index} type={type} animate={animate} />
        ))}
      </div>
      {ingredients.length === 0 && emptyText && <p className={styles.empty}>{emptyText}</p>}
      <span className={styles.plate} aria-hidden="true" />
    </div>
  );
}

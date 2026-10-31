import { INGREDIENTS } from '@/data/burgerGame';
import type { IngredientType } from '@/types/burgerGame';
import styles from './IngredientLayer.module.css';

interface IngredientLayerProps {
  type: IngredientType;
  animate?: boolean;
}

/**
 * 햄버거 한 층. 이미지가 없으면 CSS 도형으로 그린다.
 * data/burgerGame.ts 의 imageUrl 만 채우면 이미지로 바뀐다.
 */
export default function IngredientLayer({ type, animate = false }: IngredientLayerProps) {
  const ingredient = INGREDIENTS[type];
  const className = `${styles.layer} ${styles[type]} ${animate ? styles.dropIn : ''}`;

  if (ingredient.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img className={`${className} ${styles.image}`} src={ingredient.imageUrl} alt="" />
    );
  }
  return <span className={className} aria-hidden="true" />;
}

import { INGREDIENT_KEYS, INGREDIENT_ORDER, INGREDIENTS } from '@/data/burgerGame';
import { keyLabel } from '@/lib/burgerGame';
import type { IngredientType } from '@/types/burgerGame';
import styles from './IngredientPanel.module.css';

interface IngredientPanelProps {
  onSelect: (ingredient: IngredientType) => void;
  /** 키보드로 방금 누른 재료 (버튼이 눌린 것처럼 보여준다) */
  pressed?: IngredientType | null;
}

export default function IngredientPanel({ onSelect, pressed }: IngredientPanelProps) {
  return (
    <div className={styles.grid} role="group" aria-label="재료 선택">
      {INGREDIENT_ORDER.map((type) => {
        const ingredient = INGREDIENTS[type];
        const key = keyLabel(INGREDIENT_KEYS[type]);
        return (
          <button
            key={type}
            className={`${styles.button} ${pressed === type ? styles.pressed : ''}`}
            type="button"
            onClick={() => onSelect(type)}
            aria-keyshortcuts={key}
          >
            <kbd className={styles.key} aria-hidden="true">{key}</kbd>
            <span className={styles.emoji} aria-hidden="true">
              {ingredient.emoji}
            </span>
            <span className={styles.name}>{ingredient.name}</span>
          </button>
        );
      })}
    </div>
  );
}

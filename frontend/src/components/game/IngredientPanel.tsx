import { INGREDIENT_ORDER, INGREDIENTS } from '@/data/burgerGame';
import type { IngredientType } from '@/types/burgerGame';
import styles from './IngredientPanel.module.css';

interface IngredientPanelProps {
  onSelect: (ingredient: IngredientType) => void;
}

export default function IngredientPanel({ onSelect }: IngredientPanelProps) {
  return (
    <div className={styles.grid} role="group" aria-label="재료 선택">
      {INGREDIENT_ORDER.map((type) => {
        const ingredient = INGREDIENTS[type];
        return (
          <button key={type} className={styles.button} type="button" onClick={() => onSelect(type)}>
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

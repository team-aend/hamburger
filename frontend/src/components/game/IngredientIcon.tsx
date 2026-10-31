import { INGREDIENTS } from '@/data/burgerGame';
import type { IngredientType } from '@/types/burgerGame';

/** 재료 버튼·키보드 안내에 쓰는 작은 그림. 그림이 없으면 이모지로 보여준다. */
export default function IngredientIcon({ type, className }: { type: IngredientType; className?: string }) {
  const ingredient = INGREDIENTS[type];
  if (ingredient.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={className} src={ingredient.imageUrl} alt="" aria-hidden="true" />;
  }
  return (
    <span className={className} aria-hidden="true">
      {ingredient.emoji}
    </span>
  );
}

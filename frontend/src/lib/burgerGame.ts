import type { BurgerRecipe, IngredientType } from '@/types/burgerGame';

/** 재료 종류와 순서(아래 → 위)가 모두 같아야 정답이다. */
export function isOrderMatched(stack: IngredientType[], order: IngredientType[]): boolean {
  return stack.length === order.length && stack.every((ingredient, index) => ingredient === order[index]);
}

/** 직전 주문과 다른 레시피를 무작위로 고른다. (레시피가 1개뿐이면 같은 주문을 허용) */
export function pickNextOrder(
  recipes: BurgerRecipe[],
  previousId: string | null,
  random: () => number = Math.random,
): BurgerRecipe {
  if (recipes.length === 0) throw new Error('주문 레시피가 없습니다.');
  const others = recipes.filter((recipe) => recipe.id !== previousId);
  const candidates = others.length > 0 ? others : recipes;
  return candidates[Math.floor(random() * candidates.length)];
}

/** 남은 초를 00:37 형식으로 바꾼다. */
export function formatTimer(seconds: number): string {
  const safe = Math.max(0, Math.ceil(seconds));
  const minutes = String(Math.floor(safe / 60)).padStart(2, '0');
  return `${minutes}:${String(safe % 60).padStart(2, '0')}`;
}

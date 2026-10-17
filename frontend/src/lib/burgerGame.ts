import { INGREDIENT_KEYS } from '@/data/burgerGame';
import type { BurgerRecipe, IngredientType } from '@/types/burgerGame';

export type GameKeyAction =
  | { type: 'add'; ingredient: IngredientType }
  | { type: 'submit' }
  | { type: 'undo' }
  | { type: 'reset' };

/** 키 위치(KeyboardEvent.code)를 게임 동작으로 바꾼다. 게임과 상관없는 키는 null */
export function keyToAction(code: string): GameKeyAction | null {
  if (code === 'Space' || code === 'Enter' || code === 'NumpadEnter') return { type: 'submit' };
  if (code === 'Backspace') return { type: 'undo' };
  if (code === 'Escape') return { type: 'reset' };
  const ingredient = (Object.keys(INGREDIENT_KEYS) as IngredientType[]).find((type) => INGREDIENT_KEYS[type] === code);
  return ingredient ? { type: 'add', ingredient } : null;
}

/** 버튼에 보여줄 키 이름 (KeyQ → Q) */
export function keyLabel(code: string): string {
  return code.replace(/^Key/, '');
}

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

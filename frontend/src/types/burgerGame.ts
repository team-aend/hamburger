export type IngredientType =
  | 'bottomBun'
  | 'topBun'
  | 'beefPatty'
  | 'chickenPatty'
  | 'cheese'
  | 'lettuce'
  | 'tomato'
  | 'pickle'
  | 'onion'
  | 'sauce';

export interface Ingredient {
  id: IngredientType;
  name: string;
  emoji: string;
  /** 실제 PNG/WebP 이미지가 준비되면 경로만 채운다. 없으면 CSS 도형으로 그린다. */
  imageUrl?: string;
}

export type RecipeDifficulty = 'easy' | 'normal' | 'hard';

export interface BurgerRecipe {
  id: string;
  name: string;
  difficulty: RecipeDifficulty;
  /** 첫 번째 요소가 햄버거의 가장 아래 재료다. */
  ingredients: IngredientType[];
}

/** countdown: 게임 시작 버튼을 누른 뒤 3·2·1·START! 연출 중 (타이머는 아직 멈춰 있다) */
export type GameStatus = 'ready' | 'countdown' | 'playing' | 'finished';

export interface GameFeedback {
  type: 'success' | 'error';
  message: string;
  /** 같은 메시지가 연달아 나와도 다시 표시되도록 구분하는 값 */
  id: number;
}

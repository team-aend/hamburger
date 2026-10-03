import type { BurgerRecipe, Ingredient, IngredientType, RecipeDifficulty } from '@/types/burgerGame';

/** 햄버거 쌓기 게임 데이터. DB / API 없이 이 파일이 유일한 데이터 출처다. */

export const GAME_DURATION_SECONDS = 60;
export const SCORE_PER_BURGER = 100;
/** 남은 시간이 이 값 이하이면 타이머를 긴박하게 표시한다. */
export const URGENT_SECONDS = 10;
/** 시작 전 카운트다운 (3·2·1 다음에 START! 가 한 번 더 나온다) */
export const COUNTDOWN_FROM = 3;
export const COUNTDOWN_STEP_MS = 800;

/** 주문마다 바뀌는 손님 색 */
export const CUSTOMER_COLORS = ['#f5b82e', '#7fb3d5', '#e8836f', '#8fbf7a', '#c9a0dc'];

export const INGREDIENTS: Record<IngredientType, Ingredient> = {
  bottomBun: { id: 'bottomBun', name: '아래빵', emoji: '🍞' },
  topBun: { id: 'topBun', name: '위빵', emoji: '🍔' },
  beefPatty: { id: 'beefPatty', name: '소고기 패티', emoji: '🥩' },
  chickenPatty: { id: 'chickenPatty', name: '치킨 패티', emoji: '🍗' },
  cheese: { id: 'cheese', name: '치즈', emoji: '🧀' },
  lettuce: { id: 'lettuce', name: '양상추', emoji: '🥬' },
  tomato: { id: 'tomato', name: '토마토', emoji: '🍅' },
  pickle: { id: 'pickle', name: '피클', emoji: '🥒' },
  onion: { id: 'onion', name: '양파', emoji: '🧅' },
  sauce: { id: 'sauce', name: '소스', emoji: '🥫' },
};

/** 재료 선택 버튼 배치 순서 */
export const INGREDIENT_ORDER: IngredientType[] = [
  'bottomBun',
  'topBun',
  'beefPatty',
  'chickenPatty',
  'cheese',
  'lettuce',
  'tomato',
  'pickle',
  'onion',
  'sauce',
];

/** 게임 소개 / 결과 화면에 보여줄 장식용 햄버거 */
export const SHOWCASE_BURGER: IngredientType[] = [
  'bottomBun',
  'sauce',
  'beefPatty',
  'cheese',
  'tomato',
  'lettuce',
  'topBun',
];

export const DIFFICULTY_LABEL: Record<RecipeDifficulty, string> = {
  easy: '쉬움',
  normal: '보통',
  hard: '어려움',
};

/**
 * 게임용으로 만든 가상의 레시피.
 *
 * TODO: 추후에는 실제 브랜드 햄버거(맥도날드 빅맥, 버거킹 와퍼 등)를 만드는 게임으로 바꾼다.
 *  - DB 의 products / product_ingredients 에 실제 버거별 재료가 있으므로, 백엔드에 레시피 API 를 추가해
 *    이 배열 대신 API 응답을 쓴다.
 *  - 현재 DB 구조로는 레시피를 그대로 만들 수 없어서 스키마 보완이 필요하다.
 *    · ingredients 에 빵(아래빵/위빵)이 없다.
 *    · product_ingredients 의 PK 가 (product_id, ingredient_id) 라 같은 재료를 두 번 넣을 수 없다 (더블 패티 등).
 *    · sort_order 는 재료 표시 순서라서, 실제로 쌓는 순서(아래 → 위)와 같은지 확인해야 한다.
 *  - DB 재료(불고기 패티, 베이컨 등 13종)를 IngredientType 으로 매핑하거나, 재료 종류 자체를 데이터 기반으로 바꾼다.
 *  - 브랜드 이름·로고를 쓸 때는 상표 사용 범위를 먼저 확인한다.
 */
export const BURGER_RECIPES: BurgerRecipe[] = [
  // 쉬움: 재료 4~5개
  {
    id: 'cheese',
    name: '치즈 버거',
    difficulty: 'easy',
    ingredients: ['bottomBun', 'beefPatty', 'cheese', 'topBun'],
  },
  {
    id: 'simple-chicken',
    name: '심플 치킨 버거',
    difficulty: 'easy',
    ingredients: ['bottomBun', 'chickenPatty', 'sauce', 'topBun'],
  },
  {
    id: 'classic',
    name: '클래식 버거',
    difficulty: 'easy',
    ingredients: ['bottomBun', 'beefPatty', 'cheese', 'lettuce', 'topBun'],
  },
  // 보통: 재료 6~7개
  {
    id: 'double-cheese',
    name: '더블 치즈 버거',
    difficulty: 'normal',
    ingredients: ['bottomBun', 'beefPatty', 'cheese', 'beefPatty', 'cheese', 'topBun'],
  },
  {
    id: 'pickle-lover',
    name: '피클 듬뿍 버거',
    difficulty: 'normal',
    ingredients: ['bottomBun', 'beefPatty', 'pickle', 'pickle', 'onion', 'topBun'],
  },
  {
    id: 'garden',
    name: '가든 버거',
    difficulty: 'normal',
    ingredients: ['bottomBun', 'sauce', 'beefPatty', 'lettuce', 'tomato', 'onion', 'topBun'],
  },
  {
    id: 'chicken-deluxe',
    name: '치킨 디럭스 버거',
    difficulty: 'normal',
    ingredients: ['bottomBun', 'sauce', 'chickenPatty', 'cheese', 'lettuce', 'tomato', 'topBun'],
  },
  // 어려움: 재료 8개 이상
  {
    id: 'surf-tower',
    name: '반반 타워 버거',
    difficulty: 'hard',
    ingredients: [
      'bottomBun',
      'sauce',
      'beefPatty',
      'cheese',
      'chickenPatty',
      'cheese',
      'lettuce',
      'topBun',
    ],
  },
  {
    id: 'all-in-one',
    name: '올인원 버거',
    difficulty: 'hard',
    ingredients: [
      'bottomBun',
      'sauce',
      'beefPatty',
      'cheese',
      'pickle',
      'onion',
      'tomato',
      'lettuce',
      'topBun',
    ],
  },
  {
    id: 'triple-patty',
    name: '트리플 패티 버거',
    difficulty: 'hard',
    ingredients: [
      'bottomBun',
      'beefPatty',
      'cheese',
      'beefPatty',
      'pickle',
      'beefPatty',
      'cheese',
      'onion',
      'sauce',
      'topBun',
    ],
  },
];

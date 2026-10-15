import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BURGER_RECIPES, INGREDIENT_ORDER, INGREDIENTS } from '../src/data/burgerGame';
import { formatTimer, isOrderMatched, pickNextOrder } from '../src/lib/burgerGame';
import type { IngredientType } from '../src/types/burgerGame';

const order: IngredientType[] = ['bottomBun', 'beefPatty', 'cheese', 'lettuce', 'topBun'];

test('order matches only when ingredients and their order are identical', () => {
  assert.equal(isOrderMatched([...order], order), true);
  assert.equal(isOrderMatched(['bottomBun', 'cheese', 'beefPatty', 'lettuce', 'topBun'], order), false);
  assert.equal(isOrderMatched(order.slice(0, -1), order), false);
  assert.equal(isOrderMatched([...order, 'topBun'], order), false);
  assert.equal(isOrderMatched([], order), false);
});

test('next order never repeats the previous one and covers every other recipe', () => {
  const previous = BURGER_RECIPES[0];
  const picked = new Set<string>();
  for (let step = 0; step < BURGER_RECIPES.length - 1; step += 1) {
    const random = () => step / (BURGER_RECIPES.length - 1);
    const next = pickNextOrder(BURGER_RECIPES, previous.id, random);
    assert.notEqual(next.id, previous.id);
    picked.add(next.id);
  }
  assert.equal(picked.size, BURGER_RECIPES.length - 1);
  assert.equal(pickNextOrder([previous], previous.id).id, previous.id);
  assert.throws(() => pickNextOrder([], null));
});

test('timer is formatted as mm:ss and never goes negative', () => {
  assert.equal(formatTimer(60), '01:00');
  assert.equal(formatTimer(37), '00:37');
  assert.equal(formatTimer(9.2), '00:10');
  assert.equal(formatTimer(-3), '00:00');
});

test('recipes are valid burgers with the planned difficulty spread', () => {
  assert.ok(BURGER_RECIPES.length >= 8);
  assert.equal(new Set(BURGER_RECIPES.map((recipe) => recipe.id)).size, BURGER_RECIPES.length);
  assert.deepEqual(new Set(INGREDIENT_ORDER), new Set(Object.keys(INGREDIENTS)));
  const sizeRange = { easy: [4, 5], normal: [6, 7], hard: [8, Infinity] } as const;
  for (const recipe of BURGER_RECIPES) {
    const [min, max] = sizeRange[recipe.difficulty];
    assert.ok(recipe.ingredients.length >= min && recipe.ingredients.length <= max, recipe.id);
    assert.equal(recipe.ingredients[0], 'bottomBun', recipe.id);
    assert.equal(recipe.ingredients.at(-1), 'topBun', recipe.id);
  }
});

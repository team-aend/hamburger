import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchProducts, toProducts, type RecommendItem } from '../src/lib/products';

const brand = { id: 2, name: '버거킹', slug: 'burgerking' };
const item = (id: number, pattySlugs: string[], variants: RecommendItem['variants']): RecommendItem => ({
  id, name: `버거 ${id}`, slug: `burger-${id}`, brand,
  ingredients: [...pattySlugs.map((slug) => ({ slug, group: 'PATTY' })), { slug: 'lettuce', group: 'TOPPING' }],
  variants,
});
const single = (store: number, caloriesKcal: number, proteinG: number) =>
  ({ variantType: 'SINGLE' as const, prices: { store }, nutrition: { caloriesKcal, proteinG } });

test('DB 상품을 가격 비교용 Product 로 바꾸고 상품 번호 순으로 정렬한다', () => {
  const products = toProducts([
    item(8, ['beef-patty', 'shrimp-patty'], [single(7900, 768, 30), { variantType: 'SET', prices: { store: 9900 } }]),
    item(1, ['beef-patty'], [single(5500, 583, 27)]),
    item(14, ['bulgogi-patty'], [single(4800, 476, 18)]),
  ]);

  assert.deepEqual(products.map((p) => p.id), [1, 8, 14]);
  assert.deepEqual(products.map((p) => p.pattyType), ['BEEF', 'SHRIMP', 'OTHER']);
  assert.deepEqual(products[1], {
    id: 8, brand, category: 'BURGER', name: '버거 8', slug: 'burger-8', imageUrl: undefined,
    singlePrice: 7900, setPrice: 9900, calories: 768, protein: 30, pattyType: 'SHRIMP',
  });
  assert.equal(products[0].setPrice, undefined);
});

test('단품 가격이 없는 상품은 비교할 수 없어 제외한다', () => {
  const products = toProducts([item(3, ['chicken-patty'], [{ variantType: 'SET', prices: { store: 6900 } }])]);
  assert.deepEqual(products, []);
});

test('DB 조회에 성공하면 /api/recommend 결과를 Product 목록으로 돌려준다', async () => {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fakeFetch = (async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    return Response.json({ items: [{
      ...item(5, ['beef-patty'], [single(7100, 722, 31)]),
      imageUrl: '/images/burgers/burgerking-whopper-ai.png',
    }] });
  }) as typeof fetch;

  const products = await fetchProducts('http://backend:4000', fakeFetch);

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'http://backend:4000/api/recommend');
  assert.equal(calls[0].init?.cache, 'no-store');
  assert.deepEqual(products?.map((p) => [p.id, p.singlePrice, p.pattyType]), [[5, 7100, 'BEEF']]);
  assert.equal(products?.[0].imageUrl, '/images/burgers/burgerking-whopper-ai.png');
});

test('DB 조회가 실패하면 Mock 대신 null 을 돌려준다', async () => {
  const respond = (body: unknown, status = 200) => (async () => Response.json(body, { status })) as typeof fetch;
  const networkError = (async () => { throw new TypeError('fetch failed'); }) as typeof fetch;

  assert.equal(await fetchProducts('http://backend', respond({ message: 'DB 오류' }, 500)), null);
  assert.equal(await fetchProducts('http://backend', respond({ message: '형식이 다름' })), null);
  assert.equal(await fetchProducts('http://backend', networkError), null);
});

test('DB 에 상품이 없으면 빈 목록을 돌려준다 (오류와 구분)', async () => {
  const empty = (async () => Response.json({ items: [] })) as typeof fetch;
  assert.deepEqual(await fetchProducts('http://backend', empty), []);
});

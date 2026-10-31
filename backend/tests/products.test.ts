import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickSimilarProducts, type SimilarCandidate } from '../src/products/domain/similarProducts.js';
import { createGetProductDetail, ProductsStorageUnavailable, type ProductDetail } from '../src/products/application/getProductDetail.js';
import { createProductDetailHandler, parseProductId } from '../src/products/presentation/productDetailHandler.js';
import { withServer } from './helpers/http.js';

const beef = { slug: 'beef-patty', name: '소고기 패티' };
const chicken = { slug: 'chicken-patty', name: '치킨 패티' };
const candidate = (productId: string, singlePrice: number | null, patties = [beef]): SimilarCandidate => ({
  productId, name: `버거 ${productId}`, brandName: '브랜드', singlePrice, caloriesKcal: 500, patties,
});

test('similar burgers prefer the same patty, then the closest price, and exclude the burger itself', () => {
  const target = candidate('1', 6000);
  const result = pickSimilarProducts(target, [
    target,
    candidate('2', 9000),
    candidate('3', 6500, [chicken]),
    candidate('4', 6200),
    candidate('5', null),
    candidate('6', 8000, [chicken]),
  ]);
  assert.deepEqual(result.map((r) => r.productId), ['4', '2', '5', '3']);
  assert.equal(result[0].reason, '같은 소고기 패티');
  assert.equal(result[3].reason, '비슷한 가격대');
  assert.equal(pickSimilarProducts(target, [target, candidate('7', 9500, [chicken])])[0].reason, '다른 브랜드 추천');
});

const detail = (productId: string): Omit<ProductDetail, 'similar'> => ({
  productId, name: '와퍼', slug: 'whopper', description: '', imageUrl: null, status: 'ACTIVE', isLimited: false,
  brand: { brandId: '2', name: '버거킹', slug: 'burgerking', logoUrl: null }, category: '햄버거',
  ingredients: [], tags: [], variants: [], priceHistory: [], likes: { count: 0, liked: false },
  reviews: { averageRating: 0, totalCount: 0 }, worldcup: { championships: 0, appearances: 0, matches: 0, wins: 0, rank: null },
});

test('application returns null for missing products and adds similar burgers only for listed products', async () => {
  let candidateCalls = 0;
  const get = createGetProductDetail({
    findDetail: async (id) => (id === '404' ? null : detail(id)),
    listSimilarCandidates: async () => { candidateCalls++; return [candidate('5', 7100), candidate('6', 7900)]; },
  });
  assert.equal(await get('404', null), null);
  assert.equal(candidateCalls, 0);
  assert.deepEqual((await get('5', null))!.similar.map((s) => s.productId), ['6']);
  assert.deepEqual((await get('99', null))!.similar, []); // 판매 종료 등으로 후보에 없는 상품
});

test('product id keeps BIGINT precision as a string and rejects anything else', () => {
  assert.equal(parseProductId('9007199254740993'), '9007199254740993');
  for (const value of ['0', '-1', '1.5', 'abc', '01', '9223372036854775808', undefined]) {
    assert.equal(parseProductId(value), null);
  }
});

test('HTTP contract: 400 before querying, 404, 200, and storage failures', async () => {
  const calls: string[] = [];
  const handler = createProductDetailHandler(async (id, userId) => {
    calls.push(`${id}:${userId}`);
    if (id === '404') return null;
    if (id === '503') throw new ProductsStorageUnavailable();
    if (id === '500') throw new Error('secret');
    return { ...detail(id), similar: [] };
  }, () => true);
  await withServer((app) => app.get('/products/:productId', handler), async (url) => {
    assert.equal((await fetch(`${url}/products/abc`)).status, 400);
    assert.equal(calls.length, 0);
    const ok = await fetch(`${url}/products/5`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('cache-control'), 'no-store');
    assert.equal((await ok.json()).product.productId, '5');
    assert.equal(calls.at(-1), '5:7'); // 로그인 사용자 id 전달
    for (const [id, status, code] of [['404', 404, 'PRODUCT_NOT_FOUND'], ['503', 503, 'DATABASE_UNAVAILABLE'], ['500', 500, 'INTERNAL_ERROR']] as const) {
      const res = await fetch(`${url}/products/${id}`);
      assert.equal(res.status, status);
      const body = await res.json();
      assert.equal(body.error.code, code);
      assert.ok(!JSON.stringify(body).includes('secret'));
    }
  }, { id: 7 });
});

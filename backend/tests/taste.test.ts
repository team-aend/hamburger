import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTasteReport, MIN_SIGNAL_WEIGHT, type TasteProduct } from '../src/taste/domain/tasteReport.js';
import { createGetTasteReport } from '../src/taste/application/getTasteReport.js';
import { createTasteHandler } from '../src/taste/presentation/tasteHandler.js';
import { withServer } from './helpers/http.js';

const burger = (productId: string, brandName: string, singlePrice: number, patties: string[]): TasteProduct =>
  ({ productId, name: `버거 ${productId}`, brandName, singlePrice, caloriesKcal: 600, patties });

const thigh = burger('1', '맘스터치', 4900, ['치킨 패티']);
const whiteGarlic = burger('2', '맘스터치', 5600, ['치킨 패티']);
const whopper = burger('3', '버거킹', 7100, ['소고기 패티']);
const candidates = [
  thigh, whiteGarlic, whopper,
  burger('4', '맘스터치', 5300, ['치킨 패티']), // 1순위 패티 + 선호 브랜드 + 가격대
  burger('5', 'KFC', 5300, ['치킨 패티']),
  burger('6', '버거킹', 9000, ['소고기 패티']),
  burger('7', '롯데리아', 4700, ['새우 패티']),
];

test('too few signals: shows what is known but no summary or recommendations', () => {
  const report = buildTasteReport({ likes: [thigh], worldcupWins: [], highRatings: [] }, candidates);
  assert.ok(2 < MIN_SIGNAL_WEIGHT);
  assert.equal(report.enough, false);
  assert.equal(report.summary, null);
  assert.deepEqual(report.recommendations, []);
  assert.equal(report.patties[0].label, '치킨 패티');
});

test('weights likes, worldcup wins and high ratings into a summary', () => {
  const report = buildTasteReport({
    likes: [thigh, whopper],
    worldcupWins: [{ product: whiteGarlic, count: 2 }],
    highRatings: [thigh],
  }, candidates);
  // 무게: 싸이 2+2=4, 화이트갈릭 3*2=6, 와퍼 2 → 치킨 10/12, 맘스터치 10/12
  assert.equal(report.enough, true);
  assert.deepEqual(report.sources, { likes: 2, worldcupWins: 2, highRatings: 1 });
  assert.deepEqual(report.patties, [{ label: '치킨 패티', share: 83 }, { label: '소고기 패티', share: 17 }]);
  assert.equal(report.brands[0].label, '맘스터치');
  assert.equal(report.priceBand, '5천원대');
  assert.equal(report.summary, '치킨 패티파 · 5천원대 · 맘스터치 선호');
});

test('recommends unseen burgers ranked by patty, brand and price band', () => {
  const report = buildTasteReport({
    likes: [thigh, whiteGarlic, whopper], worldcupWins: [], highRatings: [],
  }, candidates);
  const ids = report.recommendations.map((r) => r.productId);
  assert.ok(!ids.some((id) => ['1', '2', '3'].includes(id)), '이미 고른 버거는 추천하지 않는다');
  assert.deepEqual(ids, ['4', '5', '6']);
  assert.deepEqual(report.recommendations[0].reasons, ['좋아하는 치킨 패티', '맘스터치', '5천원대']);
});

test('application loads signals and candidates through ports; HTTP hides internal errors', async () => {
  const get = createGetTasteReport({
    signals: async () => ({ likes: [thigh, whiteGarlic, whopper], worldcupWins: [], highRatings: [] }),
    candidates: async () => candidates,
  });
  assert.equal((await get(1)).enough, true);
  let fail = false;
  const handler = createTasteHandler(async (userId) => { if (fail) throw new Error('secret'); return get(userId); });
  await withServer((app) => app.get('/taste', handler), async (url) => {
    const ok = await fetch(`${url}/taste`);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).summary, '치킨 패티파 · 5천원대 · 맘스터치 선호');
    fail = true;
    const res = await fetch(`${url}/taste`);
    assert.equal(res.status, 500);
    assert.ok(!(await res.text()).includes('secret'));
  }, { id: 1 });
});

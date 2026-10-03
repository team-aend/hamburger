import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRankings } from '../src/data/rankings';

test('rankings use only API products, preserve large IDs and assign shared ranks', () => {
  const item = (productId: string, championships: number, wins: number) => ({
    productId, name: `실제 상품 ${productId}`, brandName: '실제 브랜드', description: null,
    imageUrl: null, championships, wins, matches: 4,
  });
  assert.deepEqual(getRankings([], 'championships'), []);
  const stats = [item('9007199254740993', 2, 1), item('9007199254740994', 2, 3), item('3', 1, 2)];
  const rankings = getRankings(stats, 'championships');
  assert.deepEqual(rankings.map((entry) => entry.rank), [1, 1, 3]);
  assert.equal(rankings[0].productId, '9007199254740993');
  assert.equal(getRankings(stats, 'winRate')[0].productId, '9007199254740994');
  assert.deepEqual(stats.map((entry) => entry.productId), ['9007199254740993', '9007199254740994', '3']);
});

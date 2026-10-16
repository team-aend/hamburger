import { test } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import { MAX_SAVED_SEARCHES, parseSavedSearchInput, SavedSearchInvalid } from '../src/savedSearches/domain/savedSearch.js';
import { createSavedSearches, type SavedSearchRepository } from '../src/savedSearches/application/savedSearches.js';
import { PgSavedSearches } from '../src/savedSearches/infrastructure/pgSavedSearches.js';
import { createSavedSearchHandlers } from '../src/savedSearches/presentation/savedSearchHandlers.js';
import { withServer } from './helpers/http.js';

const filters = {
  keyword: ' 싸이 ', brands: ['momstouch', 'momstouch'], includeIngredients: ['chicken-patty'], excludeIngredients: ['tomato'],
  minPrice: 4500, maxPrice: 6000, priceChannel: 'STORE', maxCalories: 900, variantType: 'SINGLE', sortBy: 'price_asc',
  unknownField: 'dropped',
};

test('domain normalizes a valid condition and drops unknown fields', () => {
  const parsed = parseSavedSearchInput({ name: '  점심   치킨 ', filters });
  assert.equal(parsed.name, '점심 치킨');
  assert.equal(parsed.filters.keyword, '싸이');
  assert.deepEqual(parsed.filters.brands, ['momstouch']);
  assert.ok(!('unknownField' in parsed.filters));
  assert.equal(parseSavedSearchInput({ name: '기본', filters: {} }).filters.sortBy, 'calories_asc');
});

test('domain rejects invalid names and conditions', () => {
  for (const body of [
    null, { name: '', filters }, { name: 'x'.repeat(31), filters }, { name: '이름' },
    { name: '이름', filters: { ...filters, minPrice: 7000, maxPrice: 5000 } },
    { name: '이름', filters: { ...filters, excludeIngredients: ['chicken-patty'] } },
    { name: '이름', filters: { ...filters, brands: ['<script>'] } },
    { name: '이름', filters: { ...filters, maxCalories: 1.5 } },
    { name: '이름', filters: { ...filters, sortBy: 'name' } },
    { name: '이름', filters: { ...filters, priceChannel: 'ONLINE' } },
  ]) assert.throws(() => parseSavedSearchInput(body), SavedSearchInvalid);
});

function fakeRepository(count: number) {
  const effects: string[] = [];
  const repository: SavedSearchRepository = {
    list: async () => [],
    remove: async (_user, id) => id === '1',
    transaction: async (work) => {
      effects.push('begin');
      try {
        const result = await work({
          lockAndCount: async () => { effects.push('lock'); return count; },
          insert: async (_user, name, f) => { effects.push('insert'); return { savedSearchId: '1', name, filters: f, createdAt: '2026-10-16T00:00:00Z' }; },
        });
        effects.push('commit');
        return result;
      } catch (error) { effects.push('rollback'); throw error; }
    },
  };
  return { repository, effects };
}

test('application locks before counting and saves nothing past the limit', async () => {
  const ok = fakeRepository(MAX_SAVED_SEARCHES - 1);
  await createSavedSearches(ok.repository).create(1, { name: '조건', filters });
  assert.deepEqual(ok.effects, ['begin', 'lock', 'insert', 'commit']);

  const full = fakeRepository(MAX_SAVED_SEARCHES);
  await assert.rejects(createSavedSearches(full.repository).create(1, { name: '조건', filters }));
  assert.deepEqual(full.effects, ['begin', 'lock', 'rollback']);

  const invalid = fakeRepository(0);
  await assert.rejects(createSavedSearches(invalid.repository).create(1, { name: '' }));
  assert.deepEqual(invalid.effects, [], '검증 실패는 트랜잭션을 열지 않는다');
});

test('HTTP contract: 201, 400, 409, 204, 404', async () => {
  const handlers = (count: number) => createSavedSearchHandlers(createSavedSearches(fakeRepository(count).repository));
  await withServer((app) => {
    app.get('/s', handlers(0).list);
    app.post('/s', handlers(0).create);
    app.post('/full', handlers(MAX_SAVED_SEARCHES).create);
    app.delete('/s/:savedSearchId', handlers(0).remove);
  }, async (url) => {
    const post = (path: string, body: unknown) => fetch(`${url}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    assert.equal((await fetch(`${url}/s`)).status, 200);
    const created = await post('/s', { name: '조건', filters });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).item.name, '조건');
    assert.equal((await (await post('/s', { name: '' })).json()).error.code, 'INVALID_SAVED_SEARCH');
    const full = await post('/full', { name: '조건', filters });
    assert.equal(full.status, 409);
    assert.equal((await full.json()).error.code, 'SAVED_SEARCH_LIMIT');
    assert.equal((await fetch(`${url}/s/1`, { method: 'DELETE' })).status, 204);
    assert.equal((await fetch(`${url}/s/2`, { method: 'DELETE' })).status, 404);
    assert.equal((await fetch(`${url}/s/abc`, { method: 'DELETE' })).status, 400);
  }, { id: 1 });
});

test('SQL saves, lists newest first and deletes only the owner\'s conditions', {
  skip: !process.env.TEST_DATABASE_URL,
}, async () => {
  const pool = new pg.Pool({ connectionString: process.env.TEST_DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TEMP TABLE users (id bigint);
      CREATE TEMP TABLE saved_searches (id bigserial, user_id bigint, name text, filters jsonb, created_at timestamptz DEFAULT clock_timestamp());
      INSERT INTO users VALUES (1), (2);
    `);
    // 임시 테이블은 연결마다 따로라, 트랜잭션도 같은 연결에서 실행한다.
    const single = { query: client.query.bind(client), connect: async () => Object.assign(client, { release: () => undefined }) };
    const repo = new PgSavedSearches(single as unknown as pg.Pool);
    const saved = createSavedSearches(repo);
    const first = await saved.create(1, { name: '첫번째', filters });
    await saved.create(1, { name: '두번째', filters });
    assert.deepEqual((await saved.list(1)).map((s) => s.name), ['두번째', '첫번째']);
    assert.equal((await saved.list(1))[0].filters.brands[0], 'momstouch');
    assert.equal(await saved.remove(2, first.savedSearchId), false);
    assert.equal(await saved.remove(1, first.savedSearchId), true);
    assert.equal((await saved.list(1)).length, 1);
  } finally {
    client.release();
    await pool.end();
  }
});

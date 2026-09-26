import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Request, Response } from 'express';
import { createOptionsHandler } from '../src/routes/worldcup.js';
import { getDatabaseUrl, getDbPool } from '../src/db/pool.js';

async function invoke(count: () => Promise<number>, configured = true) {
  let status = 0;
  let body: any;
  const headers: Record<string, string> = {};
  const res = {
    setHeader(key: string, value: string) { headers[key] = value; },
    status(code: number) { status = code; return this; },
    json(value: unknown) { body = value; return this; },
  } as unknown as Response;
  await createOptionsHandler(count, () => configured)({} as Request, res);
  return { status, body, headers };
}

for (const count of [0, 7, 8, 15, 16, 18]) {
  test(`options with ${count} eligible products`, async () => {
    let calls = 0;
    const result = await invoke(async () => { calls++; return count; });
    assert.equal(calls, 1);
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, {
      eligibleProductCount: count,
      roundOptions: [{ roundSize: 8, available: count >= 8 }, { roundSize: 16, available: count >= 16 }],
    });
    assert.equal(result.headers['Cache-Control'], 'no-store');
  });
}

test('missing configuration does not query DB or return mock data', async () => {
  const result = await invoke(async () => { throw new Error('must not query'); }, false);
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'DATABASE_NOT_CONFIGURED');
  assert.equal(result.body.eligibleProductCount, undefined);
});

test('DB failure is not an empty result and does not expose internal details', async () => {
  const result = await invoke(async () => { throw new Error('private-database-details'); });
  assert.equal(result.status, 503);
  assert.equal(result.body.error.code, 'DATABASE_UNAVAILABLE');
  assert.ok(!JSON.stringify(result.body).includes('private-database-details'));
  assert.equal(result.body.eligibleProductCount, undefined);
});

test('database configuration has no hardcoded fallback', () => {
  const original = process.env.DATABASE_URL;
  try {
    delete process.env.DATABASE_URL;
    assert.throws(() => getDatabaseUrl(), /DATABASE_URL/);
    assert.throws(() => getDbPool(), /DATABASE_URL/);
    process.env.DATABASE_URL = 'postgresql://user:[YOUR-PASSWORD]@localhost/db';
    assert.throws(() => getDatabaseUrl(), /DATABASE_URL/);
    process.env.DATABASE_URL = '  postgresql://localhost/test  ';
    assert.equal(getDatabaseUrl(), 'postgresql://localhost/test');
  } finally {
    if (original === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = original;
  }
});

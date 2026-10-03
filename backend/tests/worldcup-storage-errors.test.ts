import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WorldcupStorageUnavailable } from '../src/worldcup/application/ports.js';
import { translateStorageError } from '../src/worldcup/infrastructure/storageErrors.js';

test('infrastructure converts connection failures without exposing database details', () => {
  for (const code of ['ECONNREFUSED', 'ENOTFOUND', '08006', '57014']) {
    const converted = translateStorageError(Object.assign(new Error('private connection information'), { code }));
    assert.ok(converted instanceof WorldcupStorageUnavailable);
    assert.ok(!converted.message.includes('private'));
  }
  assert.ok(translateStorageError(new Error('Connection terminated unexpectedly')) instanceof WorldcupStorageUnavailable);
});

test('constraint and application failures retain their identity', () => {
  for (const error of [Object.assign(new Error('constraint'), { code: '23503' }), new Error('domain failure')]) {
    assert.equal(translateStorageError(error), error);
  }
});

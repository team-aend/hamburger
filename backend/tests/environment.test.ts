import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadBackendEnvironment } from '../src/db/environment.js';

test('example is not loaded; actual environment takes priority over .env', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'hamburger-env-'));
  try {
    writeFileSync(path.join(directory, '.env.example'), 'DATABASE_URL=postgresql://example/test\n');
    const fallback: NodeJS.ProcessEnv = {};
    loadBackendEnvironment(directory, fallback);
    assert.equal(fallback.DATABASE_URL, undefined);
    writeFileSync(path.join(directory, '.env'), 'DATABASE_URL=postgresql://local/test\n');
    const local: NodeJS.ProcessEnv = {};
    loadBackendEnvironment(directory, local);
    assert.equal(local.DATABASE_URL, 'postgresql://local/test');
    const deployed = { DATABASE_URL: 'postgresql://deployed/test' };
    loadBackendEnvironment(directory, deployed);
    assert.equal(deployed.DATABASE_URL, 'postgresql://deployed/test');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

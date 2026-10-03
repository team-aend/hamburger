import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { parseWorldcupSession, startWorldcupSession, getWorldcupSession, voteWorldcup } from '../src/lib/worldcupSession';

const product = (id: string) => ({ productId: id, name: '버거', brandName: '브랜드', description: null, imageUrl: null });
const session = () => ({ sessionId: randomUUID(), status: 'IN_PROGRESS', roundSize: 8, expiresAt: '2026-10-04T00:00:00Z',
  progress: { completedMatches: 0, totalMatches: 7, currentRoundSize: 8, roundMatchNumber: 1, roundMatchCount: 4 },
  currentMatch: { id: randomUUID(), left: product('9007199254740993'), right: product('9007199254740994') }, winner: null });
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

test('initial, next-round and winner responses keep real product IDs', () => {
  const first = session();
  assert.equal(parseWorldcupSession(first).currentMatch?.left.productId, '9007199254740993');
  const next = { ...first, progress: { ...first.progress, completedMatches: 4, currentRoundSize: 4, roundMatchCount: 2 } };
  assert.equal(parseWorldcupSession(next).progress.currentRoundSize, 4);
  const completed = { ...first, status: 'COMPLETED', winner: first.currentMatch.left, currentMatch: null,
    progress: { ...first.progress, completedMatches: 7, currentRoundSize: null, roundMatchNumber: null, roundMatchCount: null } };
  assert.equal(parseWorldcupSession(completed).winner?.productId, first.currentMatch.left.productId);
  assert.throws(() => parseWorldcupSession({ ...first, currentMatch: { ...first.currentMatch, right: first.currentMatch.left } }));
  assert.throws(() => parseWorldcupSession({ ...completed, winner: null }));
});

test('anonymous bootstrap retries once with the same key, body and credentials', async () => {
  const original = globalThis.fetch;
  const key = randomUUID();
  const requests: RequestInit[] = [];
  globalThis.fetch = async (_url, init) => {
    requests.push(init!);
    return requests.length === 1 ? response({ error: { code: 'ANONYMOUS_SESSION_REQUIRED' } }, 428) : response(session(), 201);
  };
  try {
    await startWorldcupSession(8, key);
    assert.equal(requests.length, 2);
    assert.deepEqual(requests[0], requests[1]);
    assert.equal((requests[0].headers as Record<string, string>)['Idempotency-Key'], key);
    assert.equal(requests[0].credentials, 'same-origin');
    assert.equal(requests[0].body, JSON.stringify({ roundSize: 8 }));
  } finally { globalThis.fetch = original; }
});

test('blocked cookies stop after two requests and failures never return mock participants', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls++; return response({ error: { code: 'ANONYMOUS_SESSION_REQUIRED' } }, 428); };
  try {
    await assert.rejects(startWorldcupSession(8, randomUUID()), /쿠키/);
    assert.equal(calls, 2);
    globalThis.fetch = async () => response({ error: { message: '연결 실패' } }, 503);
    await assert.rejects(startWorldcupSession(8, randomUUID()), /연결 실패/);
  } finally { globalThis.fetch = original; }
});

test('restore and vote use session and match IDs and propagate abort signals', async () => {
  const original = globalThis.fetch;
  const value = session();
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = async (url, init) => { calls.push({ url: String(url), init: init! }); return response(value); };
  const controller = new AbortController();
  try {
    await getWorldcupSession(value.sessionId, controller.signal);
    await voteWorldcup(value.sessionId, value.currentMatch.id, value.currentMatch.left.productId, controller.signal);
    assert.equal(calls[0].url, `/api/worldcup/sessions/${value.sessionId}`);
    assert.equal(calls[1].url, `/api/worldcup/sessions/${value.sessionId}/matches/${value.currentMatch.id}/vote`);
    assert.equal(calls[1].init.body, JSON.stringify({ winnerProductId: value.currentMatch.left.productId }));
    assert.equal(calls[1].init.signal, controller.signal);
  } finally { globalThis.fetch = original; }
});

test('conflicting selections from another tab recover the latest server state', async () => {
  const original = globalThis.fetch;
  const value = session();
  value.progress.completedMatches = 1;
  value.progress.roundMatchNumber = 2;
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1 ? response({ error: { code: 'MATCH_ALREADY_DECIDED' } }, 409) : response(value);
  };
  try {
    const restored = await voteWorldcup(value.sessionId, value.currentMatch.id, value.currentMatch.left.productId);
    assert.equal(restored.progress.completedMatches, 1);
    assert.equal(calls, 2);
  } finally { globalThis.fetch = original; }
});

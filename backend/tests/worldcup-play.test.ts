import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import express from 'express';
import { decideWinner, viewSession, type StoredSession } from '../src/worldcup/domain/progression.js';
import { createPlayHandlers } from '../src/worldcup/presentation/playHandlers.js';
import { SessionNotFound } from '../src/worldcup/application/playWorldcup.js';

function fixture(): StoredSession {
  const entries = Array.from({ length: 8 }, (_, i) => ({ productId: String(i + 1), name: `Burger ${i}`, brandName: 'Brand', description: null, imageUrl: null }));
  return { sessionId: randomUUID(), status: 'IN_PROGRESS', roundSize: 8, expiresAt: '2026-10-04T00:00:00Z', completedAt: null, winnerId: null, entries,
    matches: Array.from({ length: 4 }, (_, i) => ({ id: randomUUID(), roundSize: 8, index: i, leftId: String(i * 2 + 1), rightId: String(i * 2 + 2), winnerId: null })) };
}
const now = '2026-10-03T00:00:00Z';

test('domain rejects foreign winners, future matches and conflicting retries without mutation', () => {
  const session = fixture();
  const match = session.matches[0];
  assert.throws(() => decideWinner(session, match.id, '8', now, randomUUID), { code: 'INVALID_WINNER' });
  assert.throws(() => decideWinner(session, session.matches[1].id, '3', now, randomUUID), { code: 'MATCH_NOT_CURRENT' });
  assert.throws(() => decideWinner(session, randomUUID(), '1', now, randomUUID), { code: 'MATCH_NOT_FOUND' });
  assert.equal(match.winnerId, null);
  match.winnerId = '1';
  assert.equal(decideWinner(session, match.id, '1', now, randomUUID).replayed, true);
  assert.throws(() => decideWinner(session, match.id, '2', now, randomUUID), { code: 'MATCH_ALREADY_DECIDED' });
});

test('last 8-entry decision pairs ordered winners into two new 4-entry matches', () => {
  const session = fixture();
  session.matches.slice(0, 3).forEach((match) => { match.winnerId = match.leftId; });
  const decision = decideWinner(session, session.matches[3].id, '8', now, randomUUID);
  assert.deepEqual(decision.newMatches.map((match) => [match.leftId, match.rightId]), [['1', '3'], ['5', '8']]);
  assert.equal(decision.view.progress.currentRoundSize, 4);
  assert.equal(decision.view.progress.completedMatches, 4);
  assert.equal(session.matches.length, 4);
});

test('expired and invalid sessions are handled without changing stored state', () => {
  const session = fixture();
  assert.equal(viewSession(session, '2026-10-05T00:00:00Z').status, 'EXPIRED');
  assert.equal(session.status, 'IN_PROGRESS');
  assert.throws(() => decideWinner(session, session.matches[0].id, '1', '2026-10-05T00:00:00Z', randomUUID), { code: 'SESSION_EXPIRED' });
  session.matches = [];
  assert.throws(() => viewSession(session, now), { code: 'INVALID_SESSION_STATE' });
});

test('HTTP session access requires ownership and voting requires valid origin and input', async () => {
  const session = fixture();
  let missing = false;
  let votes = 0;
  const play = createPlayHandlers({
    configured: () => true,
    allowedOrigin: () => 'http://localhost:3000',
    get: async () => { if (missing) throw new SessionNotFound(); return viewSession(session, now); },
    vote: async () => { votes++; return { ...viewSession(session, now), replayed: false }; },
  });
  const app = express(); app.use(express.json());
  app.get('/sessions/:id', play.get); app.post('/sessions/:id/matches/:matchId/vote', play.vote);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as { port: number }).port}/sessions/${session.sessionId}`;
  const Cookie = `bp_worldcup_owner=${randomBytes(32).toString('base64url')}`;
  try {
    assert.equal((await fetch(url)).status, 401);
    const response = await fetch(url, { headers: { Cookie } });
    assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'private, no-store');
    missing = true; assert.equal((await fetch(url, { headers: { Cookie } })).status, 404); missing = false;
    const voteUrl = `${url}/matches/${session.matches[0].id}/vote`;
    const request = (body: unknown, origin = 'http://localhost:3000') => fetch(voteUrl, { method: 'POST', headers: { Cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await request({ winnerProductId: '1' }, 'https://evil.example')).status, 403);
    for (const body of [{ winnerProductId: 1 }, { winnerProductId: '0' }, { winnerProductId: '9223372036854775808' }, { winnerProductId: '1', extra: true }]) {
      assert.equal((await request(body)).status, 400);
    }
    assert.equal(votes, 0);
    assert.equal((await request({ winnerProductId: '1' })).status, 200); assert.equal(votes, 1);
    for (let i = 0; i < 59; i++) assert.equal((await request({ winnerProductId: '1' })).status, 200);
    const limited = await request({ winnerProductId: '1' });
    assert.equal(limited.status, 429);
    assert.ok(limited.headers.get('retry-after'));
    assert.equal(votes, 60);
  } finally { await new Promise<void>((resolve) => server.close(() => resolve())); }
});

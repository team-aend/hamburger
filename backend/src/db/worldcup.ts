import { getDbPool } from './pool.js';

export interface WorldcupMatchInput {
  /** 16, 8, 4, 2(결승) */
  round: number;
  winner: string;
  loser: string;
}

export interface WorldcupResultInput {
  roundSize: 8 | 16;
  winnerBurgerId: string;
  matches: WorldcupMatchInput[];
}

export class WorldcupValidationError extends Error {}
export class WorldcupRateLimitError extends Error {}

const BURGER_ID_PATTERN = /^[a-z0-9-]{1,50}$/;
/** 같은 사용자가 이 시간 안에 다시 저장하면 거절 (8강도 최소 7번 선택해야 하므로 사람 속도로는 걸리지 않음) */
const MIN_SUBMIT_INTERVAL_SECONDS = 5;

/**
 * 토너먼트가 실제로 성립하는지 검증한다.
 * - 라운드별 대결 수가 맞는지 (16강 8경기 → 8강 4경기 → ... → 결승 1경기)
 * - 각 라운드 승자들이 정확히 다음 라운드 참가자인지
 * - 결승 승자가 우승 버거인지
 */
export function validateWorldcupResult(body: unknown): WorldcupResultInput {
  const input = body as Partial<WorldcupResultInput> | null;
  if (!input || (input.roundSize !== 8 && input.roundSize !== 16)) {
    throw new WorldcupValidationError('roundSize 는 8 또는 16 이어야 합니다.');
  }
  const { roundSize } = input;
  if (typeof input.winnerBurgerId !== 'string' || !BURGER_ID_PATTERN.test(input.winnerBurgerId)) {
    throw new WorldcupValidationError('winnerBurgerId 가 올바르지 않습니다.');
  }
  if (!Array.isArray(input.matches) || input.matches.length !== roundSize - 1) {
    throw new WorldcupValidationError(`${roundSize}강은 대결이 ${roundSize - 1}개여야 합니다.`);
  }

  const matches: WorldcupMatchInput[] = input.matches.map((match) => {
    const m = match as Partial<WorldcupMatchInput> | null;
    if (
      !m ||
      typeof m.round !== 'number' ||
      typeof m.winner !== 'string' ||
      typeof m.loser !== 'string' ||
      !BURGER_ID_PATTERN.test(m.winner) ||
      !BURGER_ID_PATTERN.test(m.loser) ||
      m.winner === m.loser
    ) {
      throw new WorldcupValidationError('대결 정보가 올바르지 않습니다.');
    }
    return { round: m.round, winner: m.winner, loser: m.loser };
  });

  let participants: string[] | null = null;
  for (let round = roundSize; round >= 2; round /= 2) {
    const roundMatches = matches.filter((m) => m.round === round);
    if (roundMatches.length !== round / 2) {
      throw new WorldcupValidationError(`${round}강 대결 수가 맞지 않습니다.`);
    }
    const players = roundMatches.flatMap((m) => [m.winner, m.loser]);
    if (new Set(players).size !== players.length) {
      throw new WorldcupValidationError(`${round}강에 같은 버거가 두 번 나왔습니다.`);
    }
    if (participants) {
      const expected = new Set(participants);
      if (players.length !== expected.size || !players.every((id) => expected.has(id))) {
        throw new WorldcupValidationError(`${round}강 참가자가 이전 라운드 승자와 다릅니다.`);
      }
    }
    participants = roundMatches.map((m) => m.winner);
  }

  if (participants?.[0] !== input.winnerBurgerId) {
    throw new WorldcupValidationError('결승 승자와 우승 버거가 다릅니다.');
  }

  return { roundSize, winnerBurgerId: input.winnerBurgerId, matches };
}

export async function saveWorldcupResult(
  userId: number,
  input: WorldcupResultInput
): Promise<{ id: number; createdAt: string }> {
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');

    // 같은 사용자의 동시 저장을 직렬화한 뒤 연속 저장(도배)을 막는다.
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const recent = await client.query(
      `SELECT 1 FROM worldcup_results
        WHERE user_id = $1 AND created_at > NOW() - make_interval(secs => $2)
        LIMIT 1`,
      [userId, MIN_SUBMIT_INTERVAL_SECONDS]
    );
    if (recent.rows.length > 0) {
      throw new WorldcupRateLimitError('잠시 후 다시 시도해 주세요.');
    }

    const { rows } = await client.query(
      `INSERT INTO worldcup_results (user_id, round_size, winner_burger_id)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [userId, input.roundSize, input.winnerBurgerId]
    );
    const resultId = rows[0].id;

    await client.query(
      `INSERT INTO worldcup_matches (result_id, round_size, winner_burger_id, loser_burger_id)
       SELECT $1, * FROM UNNEST($2::smallint[], $3::varchar[], $4::varchar[])`,
      [
        resultId,
        input.matches.map((m) => m.round),
        input.matches.map((m) => m.winner),
        input.matches.map((m) => m.loser),
      ]
    );

    await client.query('COMMIT');
    return { id: Number(resultId), createdAt: new Date(rows[0].created_at).toISOString() };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function getUserWorldcupHistory(userId: number, limit = 50) {
  const pool = getDbPool();
  const [resultsRes, summaryRes] = await Promise.all([
    pool.query(
      `SELECT id, round_size, winner_burger_id, created_at
         FROM worldcup_results
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [userId, limit]
    ),
    pool.query(
      `SELECT winner_burger_id, COUNT(*)::int AS count
         FROM worldcup_results
        WHERE user_id = $1
        GROUP BY winner_burger_id
        ORDER BY count DESC, MAX(created_at) DESC`,
      [userId]
    ),
  ]);

  return {
    total: summaryRes.rows.reduce((sum, row) => sum + row.count, 0),
    championships: summaryRes.rows.map((row) => ({
      burgerId: row.winner_burger_id as string,
      count: row.count as number,
    })),
    results: resultsRes.rows.map((row) => ({
      id: Number(row.id),
      roundSize: Number(row.round_size),
      winnerBurgerId: row.winner_burger_id as string,
      createdAt: new Date(row.created_at).toISOString(),
    })),
  };
}

/** 랭킹: 버거별 우승 횟수, 대결 수, 대결 승리 수 */
export async function getWorldcupRankingStats() {
  const pool = getDbPool();
  const [championshipsRes, matchesRes, totalRes] = await Promise.all([
    pool.query(
      `SELECT winner_burger_id AS burger_id, COUNT(*)::int AS count
         FROM worldcup_results GROUP BY winner_burger_id`
    ),
    pool.query(
      `SELECT burger_id, SUM(wins)::int AS wins, SUM(matches)::int AS matches FROM (
         SELECT winner_burger_id AS burger_id, COUNT(*) AS wins, COUNT(*) AS matches
           FROM worldcup_matches GROUP BY winner_burger_id
         UNION ALL
         SELECT loser_burger_id, 0, COUNT(*)
           FROM worldcup_matches GROUP BY loser_burger_id
       ) t GROUP BY burger_id`
    ),
    pool.query('SELECT COUNT(*)::int AS count FROM worldcup_results'),
  ]);

  const stats = new Map<string, { championships: number; matches: number; wins: number }>();
  const entry = (id: string) => {
    if (!stats.has(id)) stats.set(id, { championships: 0, matches: 0, wins: 0 });
    return stats.get(id)!;
  };
  for (const row of championshipsRes.rows) entry(row.burger_id).championships = row.count;
  for (const row of matchesRes.rows) {
    entry(row.burger_id).wins = row.wins;
    entry(row.burger_id).matches = row.matches;
  }

  return {
    totalResults: totalRes.rows[0].count as number,
    stats: [...stats].map(([burgerId, value]) => ({ burgerId, ...value })),
  };
}

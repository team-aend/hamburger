import { getDbPool } from './pool.js';

export interface User {
  id: number;
  email: string | null;
  /** 화면에 보이는 이름: 닉네임이 있으면 닉네임, 없으면 소셜 계정 이름 */
  displayName: string;
  avatarUrl: string | null;
}

export interface SocialProfile {
  provider: 'GOOGLE';
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}

export interface UserProfile extends User {
  nickname: string | null;
  /** 소셜 계정에서 받은 이름 (닉네임 초기화 시 돌아갈 이름) */
  socialName: string;
  createdAt: string;
  identities: { provider: string; email: string | null; connectedAt: string }[];
  stats: { likes: number; worldcups: number };
}

const USER_COLUMNS = 'id, email, display_name, nickname, avatar_url';

interface UserRow {
  id: string | number;
  email: string | null;
  display_name: string;
  nickname: string | null;
  avatar_url: string | null;
}

function toUser(row: UserRow): User {
  return {
    id: Number(row.id),
    email: row.email,
    displayName: row.nickname || row.display_name,
    avatarUrl: row.avatar_url,
  };
}

export async function findUserById(id: number): Promise<User | null> {
  const { rows } = await getDbPool().query(
    `SELECT ${USER_COLUMNS} FROM users WHERE id = $1`,
    [id]
  );
  return rows[0] ? toUser(rows[0]) : null;
}

/**
 * 소셜 계정으로 로그인한 사용자를 찾거나 새로 만든다.
 * - 이미 연결된 계정이면 프로필(이름/사진/이메일)과 마지막 로그인 시각을 갱신 (닉네임은 유지)
 * - 처음이면 users + user_identities 를 함께 생성
 */
export async function upsertSocialUser(profile: SocialProfile): Promise<User> {
  const client = await getDbPool().connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT user_id FROM user_identities WHERE provider = $1 AND provider_user_id = $2 FOR UPDATE',
      [profile.provider, profile.providerUserId]
    );

    let userRow;
    if (existing.rows[0]) {
      const userId = existing.rows[0].user_id;
      await client.query(
        'UPDATE user_identities SET email = $1, updated_at = NOW() WHERE provider = $2 AND provider_user_id = $3',
        [profile.email, profile.provider, profile.providerUserId]
      );
      const updated = await client.query(
        `UPDATE users
            SET email = $1, display_name = $2, avatar_url = $3,
                last_login_at = NOW(), updated_at = NOW()
          WHERE id = $4
          RETURNING ${USER_COLUMNS}`,
        [profile.email, profile.displayName, profile.avatarUrl, userId]
      );
      userRow = updated.rows[0];
    } else {
      const created = await client.query(
        `INSERT INTO users (email, display_name, avatar_url)
         VALUES ($1, $2, $3)
         RETURNING ${USER_COLUMNS}`,
        [profile.email, profile.displayName, profile.avatarUrl]
      );
      userRow = created.rows[0];
      await client.query(
        `INSERT INTO user_identities (user_id, provider, provider_user_id, email)
         VALUES ($1, $2, $3, $4)`,
        [userRow.id, profile.provider, profile.providerUserId, profile.email]
      );
    }

    await client.query('COMMIT');
    return toUser(userRow);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserProfile(userId: number): Promise<UserProfile | null> {
  const pool = getDbPool();
  const [userRes, identitiesRes, statsRes] = await Promise.all([
    pool.query(`SELECT ${USER_COLUMNS}, created_at FROM users WHERE id = $1`, [userId]),
    pool.query(
      `SELECT provider, email, created_at FROM user_identities
        WHERE user_id = $1 ORDER BY created_at`,
      [userId]
    ),
    pool.query(
      `SELECT
         (SELECT COUNT(*)::int FROM product_likes WHERE user_id = $1) AS likes,
         (SELECT COUNT(*)::int FROM worldcup_results WHERE user_id = $1) AS worldcups`,
      [userId]
    ),
  ]);

  const row = userRes.rows[0];
  if (!row) return null;
  return {
    ...toUser(row),
    nickname: row.nickname,
    socialName: row.display_name,
    createdAt: new Date(row.created_at).toISOString(),
    identities: identitiesRes.rows.map((identity) => ({
      provider: identity.provider,
      email: identity.email,
      connectedAt: new Date(identity.created_at).toISOString(),
    })),
    stats: statsRes.rows[0],
  };
}

/** 닉네임 변경. null 이면 닉네임을 지우고 소셜 계정 이름을 쓴다. */
export async function updateNickname(userId: number, nickname: string | null): Promise<void> {
  await getDbPool().query(
    'UPDATE users SET nickname = $1, updated_at = NOW() WHERE id = $2',
    [nickname, userId]
  );
}

/**
 * 회원 탈퇴. users 행을 지우면
 * - user_identities, product_likes 는 함께 삭제 (ON DELETE CASCADE)
 * - worldcup_results 는 user_id 만 NULL 이 되어 랭킹 통계로만 남는다 (ON DELETE SET NULL)
 */
export async function deleteUser(userId: number): Promise<void> {
  await getDbPool().query('DELETE FROM users WHERE id = $1', [userId]);
}

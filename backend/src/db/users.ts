import { getDbPool } from './pool.js';

export interface User {
  id: number;
  email: string | null;
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

function toUser(row: {
  id: string | number;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
}): User {
  return {
    id: Number(row.id),
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
  };
}

export async function findUserById(id: number): Promise<User | null> {
  const { rows } = await getDbPool().query(
    'SELECT id, email, display_name, avatar_url FROM users WHERE id = $1',
    [id]
  );
  return rows[0] ? toUser(rows[0]) : null;
}

/**
 * 소셜 계정으로 로그인한 사용자를 찾거나 새로 만든다.
 * - 이미 연결된 계정이면 프로필(이름/사진/이메일)과 마지막 로그인 시각을 갱신
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
          RETURNING id, email, display_name, avatar_url`,
        [profile.email, profile.displayName, profile.avatarUrl, userId]
      );
      userRow = updated.rows[0];
    } else {
      const created = await client.query(
        `INSERT INTO users (email, display_name, avatar_url)
         VALUES ($1, $2, $3)
         RETURNING id, email, display_name, avatar_url`,
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

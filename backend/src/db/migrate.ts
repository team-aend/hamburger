import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { getDbPool } from './pool.js';

dotenv.config();

/**
 * src/db/migrations/*.sql 을 파일명 순서대로 실행한다.
 * 모든 SQL은 IF NOT EXISTS 또는 기존 값을 보존하는 조건부 UPDATE로 작성해
 * 여러 번 실행해도 안전하게 유지한다. db:init처럼 시드 전체를 덮어쓰지 않는다.
 */
async function migrate() {
  const pool = getDbPool();
  const dir = fs.existsSync(path.resolve(__dirname, 'migrations'))
    ? path.resolve(__dirname, 'migrations')
    : path.resolve(process.cwd(), 'backend/src/db/migrations');
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const file of files) {
      await client.query(fs.readFileSync(path.join(dir, file), 'utf-8'));
      console.log(`✅ ${file}`);
    }
    await client.query('COMMIT');
    console.log(`🎉 마이그레이션 ${files.length}개 적용 완료`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ 마이그레이션 중 오류가 발생했습니다:', err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

void migrate();

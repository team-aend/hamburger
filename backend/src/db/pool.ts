import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

const { Pool } = pg;

export function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (!envUrl || envUrl.length === 0 || envUrl.includes('[YOUR-PASSWORD]')) {
    throw new Error(
      'DATABASE_URL 환경변수가 설정되지 않았거나 유효하지 않습니다. backend/.env 파일에 실제 DB 접속 주소를 설정해 주세요.'
    );
  }
  return envUrl;
}

export function isDbConfigured(): boolean {
  const envUrl = process.env.DATABASE_URL?.trim();
  return Boolean(envUrl && envUrl.length > 0 && !envUrl.includes('[YOUR-PASSWORD]'));
}

let poolInstance: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString = getDatabaseUrl();
    poolInstance = new Pool({
      connectionString,
      max: 15,
      idleTimeoutMillis: 60_000,
      connectionTimeoutMillis: 10_000,
      keepAlive: true,
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return poolInstance;
}

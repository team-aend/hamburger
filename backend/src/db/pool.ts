import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// 팀 공용 Supabase PostgreSQL 기본 접속 주소 (.env 미설정 시 기본값으로 사용)
const DEFAULT_SUPABASE_URL =
  'postgresql://postgres:Aend12%21%40team@db.lyjsyiguasujjdsltjem.supabase.co:5432/postgres';

export function getDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl && envUrl.length > 0 && !envUrl.includes('[YOUR-PASSWORD]')) {
    return envUrl;
  }
  return DEFAULT_SUPABASE_URL;
}

export function isDbConfigured(): boolean {
  return Boolean(getDatabaseUrl());
}

let poolInstance: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!poolInstance) {
    poolInstance = new Pool({
      connectionString: getDatabaseUrl(),
      ssl: {
        rejectUnauthorized: false,
      },
    });
  }
  return poolInstance;
}

import pg from 'pg';
import { loadBackendEnvironment } from './environment.js';

loadBackendEnvironment();

export function getDatabaseUrl(): string {
  if (!isDbConfigured()) {
    throw new Error('DATABASE_URL 환경변수가 설정되지 않았거나 유효하지 않습니다. backend/.env 파일에 실제 DB 접속 주소를 설정해 주세요.');
  }
  return process.env.DATABASE_URL!.trim();
}

export function isDbConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && !url.includes('[YOUR-PASSWORD]'));
}

let poolInstance: pg.Pool | null = null;

export function getDbPool(): pg.Pool {
  if (!poolInstance) {
    const connectionString = getDatabaseUrl();
    if (!connectionString) throw new Error('DATABASE_URL이 설정되어 있지 않습니다.');
    poolInstance = new pg.Pool({
      connectionString,
      ssl: { rejectUnauthorized: true, ...(process.env.DATABASE_SSL_CA ? { ca: process.env.DATABASE_SSL_CA } : {}) },
      max: 5,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
      query_timeout: 5000,
      statement_timeout: 5000,
    });
    // Do not print database error objects: they can contain connection details.
    poolInstance.on('error', () => console.error('DATABASE_POOL_ERROR'));
  }
  return poolInstance;
}

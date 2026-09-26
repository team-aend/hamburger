import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  return url && !url.includes('[YOUR-PASSWORD]') ? url : '';
}

export function isDbConfigured(): boolean {
  return Boolean(getDatabaseUrl());
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

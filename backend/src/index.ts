import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { getDatabaseUrl, isDbConfigured } from './db/pool.js';

dotenv.config();

const app: Application = express();
const PORT = Number(process.env.PORT) || 4000;
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Middleware
app.use(
  cors({
    origin: CORS_ORIGIN,
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRouter);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
  if (isDbConfigured()) {
    const hostPart = getDatabaseUrl().split('@')[1] || 'PostgreSQL';
    console.log(`📦 Database Mode: Supabase PostgreSQL Connected (${hostPart})`);
  } else {
    console.warn(
      '⚠️ 경고: backend/.env 에 DATABASE_URL이 설정되지 않았습니다. DB 연결을 위해 .env 파일을 설정해 주세요.'
    );
  }
});

import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import apiRouter from './routes/index.js';
import { isDbConfigured } from './db/pool.js';
import { prewarmDatasetCache } from './db/datasetCache.js';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), 'backend/.env') });

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
  console.log(
    `📦 Database Mode: ${
      isDbConfigured()
        ? 'PostgreSQL configured (connection not yet verified)'
        : 'PostgreSQL not configured; worldcup options unavailable'
    }`
  );
  if (isDbConfigured()) {
    void prewarmDatasetCache();
  }
});

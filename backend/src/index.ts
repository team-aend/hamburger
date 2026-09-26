import express, { Application } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import apiRouter from './routes/index.js';
import { isDbConfigured } from './db/pool.js';

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
  console.log(
    `📦 Database Mode: ${
      isDbConfigured()
        ? 'Supabase PostgreSQL Connected (db.lyjsyiguasujjdsltjem.supabase.co)'
        : 'In-Memory Seed Fallback'
    }`
  );
});

import { Router, Request, Response } from 'express';
import recommendRouter from './recommend.js';
import brandsRouter from './brands.js';
import authRouter from './auth.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    service: 'hamburger-backend',
    timestamp: new Date().toISOString(),
  });
});

router.get('/hello', (_req: Request, res: Response) => {
  res.status(200).json({
    message: '안녕하세요! Node.js(Express) + TypeScript 백엔드 서버가 정상 동작 중입니다. 🍔',
  });
});

router.use('/auth', authRouter);
router.use('/brands', brandsRouter);
router.use('/recommend', recommendRouter);

export default router;

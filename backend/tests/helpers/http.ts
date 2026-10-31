import express, { type RequestHandler } from 'express';

/**
 * 핸들러를 임시 HTTP 서버로 띄워 fetch 로 검증한다. (supertest 없이)
 * user 를 넘기면 requireAuth 를 통과한 것처럼 req.user 를 채운다.
 */
export async function withServer(
  mount: (app: express.Express) => void,
  run: (url: string) => Promise<void>,
  user: { id: number } | null = null,
) {
  const app = express();
  app.use(express.json());
  app.use(((req, _res, next) => {
    req.user = user ? { id: user.id, email: null, displayName: 'tester', avatarUrl: null } : null;
    next();
  }) as RequestHandler);
  mount(app);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  try {
    await run(`http://127.0.0.1:${(server.address() as { port: number }).port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

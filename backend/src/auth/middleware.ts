import type { NextFunction, Request, Response } from 'express';
import { findUserById, type User } from '../db/users.js';
import { clearSessionCookie, readSessionUserId } from './session.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** 로그인한 사용자. 비로그인이면 null, 아직 확인 전이면 undefined */
      user?: User | null;
    }
  }
}

/**
 * 세션 쿠키로 req.user 를 채운다. 한 요청에서 한 번만 DB 를 조회한다.
 * 세션은 있는데 사용자가 삭제된 경우 쿠키를 지운다.
 */
async function loadUser(req: Request, res: Response): Promise<User | null> {
  if (req.user !== undefined) return req.user;

  const userId = readSessionUserId(req);
  req.user = userId === null ? null : await findUserById(userId);
  if (userId !== null && !req.user) clearSessionCookie(res);
  return req.user;
}

/**
 * 로그인하지 않아도 되지만, 로그인했다면 사용자 정보가 필요한 API 에 붙인다.
 *   router.get('/something', optionalAuth, handler)   // req.user 는 User | null
 *
 * 추천/검색처럼 사용자와 무관한 API 에는 붙이지 않는다. (요청마다 DB 조회가 생기므로)
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    await loadUser(req, res);
    next();
  } catch (error) {
    next(error);
  }
}

/**
 * 로그인이 필수인 API 에 붙인다. 비로그인이면 401 + code: 'LOGIN_REQUIRED'.
 *   router.post('/something', requireAuth, handler)   // req.user 는 항상 User
 */
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!(await loadUser(req, res))) {
      res.status(401).json({
        code: 'LOGIN_REQUIRED',
        message: '로그인이 필요한 기능입니다.',
      });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}

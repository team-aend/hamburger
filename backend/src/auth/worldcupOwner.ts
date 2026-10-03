import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';
import { parseCookies } from './session.js';

export const WORLDCUP_OWNER_COOKIE = 'bp_worldcup_owner';
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function readWorldcupOwner(req: Request): string | null {
  const token = parseCookies(req)[WORLDCUP_OWNER_COOKIE];
  // Require the canonical encoding of exactly 32 random bytes.
  if (!token || !TOKEN_PATTERN.test(token) || Buffer.from(token, 'base64url').toString('base64url') !== token) {
    return null;
  }
  return createHash('sha256').update(token).digest('hex');
}

export function setWorldcupOwner(res: Response): void {
  res.cookie(WORLDCUP_OWNER_COOKIE, randomBytes(32).toString('base64url'), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

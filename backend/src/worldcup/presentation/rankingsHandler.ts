import type { Request, Response } from 'express';
import type { RankingsInput, RankingsResult } from '../application/getRankings.js';
import { WorldcupStorageUnavailable } from '../application/ports.js';

export function parseRankingsQuery(query: Request['query']): RankingsInput {
  const scalar = (key: string, fallback: string): string => {
    const value = query[key];
    if (value === undefined) return fallback;
    if (typeof value !== 'string') throw new Error('invalid query');
    return value;
  };
  const integer = (key: string, fallback: string, max: number) => {
    const value = scalar(key, fallback);
    const number = Number(value);
    if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(number) || number > max) throw new Error('invalid integer');
    return number;
  };
  const sort = scalar('sort', 'championships');
  const roundSize = scalar('roundSize', '');
  const q = scalar('q', '').trim();
  if (!['championships', 'winRate'].includes(sort) || !['', '8', '16'].includes(roundSize) || [...q].length > 100) {
    throw new Error('invalid query');
  }
  return {
    sort: sort as RankingsInput['sort'], roundSize: roundSize ? Number(roundSize) as 8 | 16 : null,
    q, page: integer('page', '1', Math.floor(Number.MAX_SAFE_INTEGER / 100)), pageSize: integer('pageSize', '20', 100),
  };
}

export function createRankingsHandler(read: (input: RankingsInput) => Promise<RankingsResult>, configured: () => boolean) {
  return async (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    let input: RankingsInput;
    try { input = parseRankingsQuery(req.query); }
    catch {
      res.status(400).json({ error: { code: 'INVALID_QUERY', message: '랭킹 조회 조건을 확인해 주세요.' } });
      return;
    }
    try {
      if (!configured()) throw new WorldcupStorageUnavailable();
      res.status(200).json(await read(input));
    } catch (error) {
      const unavailable = error instanceof WorldcupStorageUnavailable;
      res.status(unavailable ? 503 : 500).json({ error: {
        code: unavailable ? 'DATABASE_UNAVAILABLE' : 'INTERNAL_ERROR',
        message: '랭킹을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
      } });
    }
  };
}

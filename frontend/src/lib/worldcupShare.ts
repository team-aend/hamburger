import type { WorldcupProduct } from '@/lib/worldcupSession';

/** GET /api/worldcup/share/:sessionId 응답 */
export interface WorldcupShare {
  sessionId: string;
  roundSize: 8 | 16;
  completedAt: string;
  winner: WorldcupProduct;
  path: { roundSize: number; opponent: WorldcupProduct }[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 서버(페이지·미리보기 이미지)에서 공유 결과를 불러온다. 없거나 링크가 잘못됐으면 null */
export async function fetchWorldcupShare(sessionId: string): Promise<WorldcupShare | null> {
  if (!UUID.test(sessionId)) return null;
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res = await fetch(`${backendUrl}/api/worldcup/share/${sessionId}`, { cache: 'no-store' });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`월드컵 결과를 불러오지 못했습니다. (${res.status})`);
  return res.json();
}

export const roundLabel = (roundSize: number) => (roundSize === 2 ? '결승' : `${roundSize}강`);

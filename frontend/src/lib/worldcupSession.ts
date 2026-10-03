export type WorldcupRoundSize = 8 | 16;

export interface WorldcupProduct {
  productId: string;
  name: string;
  brandName: string;
  description: string | null;
  imageUrl: string | null;
}

export interface WorldcupSession {
  sessionId: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'ABANDONED' | 'EXPIRED';
  roundSize: WorldcupRoundSize;
  expiresAt: string;
  completedAt?: string | null;
  progress: {
    completedMatches: number;
    totalMatches: number;
    currentRoundSize: 2 | 4 | WorldcupRoundSize | null;
    roundMatchNumber: number | null;
    roundMatchCount: number | null;
  };
  currentMatch: { id: string; left: WorldcupProduct; right: WorldcupProduct } | null;
  winner: WorldcupProduct | null;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isProduct(value: unknown): value is WorldcupProduct {
  if (!value || typeof value !== 'object') return false;
  const product = value as WorldcupProduct;
  return typeof product.productId === 'string' && /^[1-9]\d*$/.test(product.productId) &&
    typeof product.name === 'string' && typeof product.brandName === 'string' &&
    (product.description === null || typeof product.description === 'string') &&
    (product.imageUrl === null || typeof product.imageUrl === 'string');
}

export function parseWorldcupSession(value: unknown): WorldcupSession {
  const session = value as WorldcupSession | null;
  const progress = session?.progress;
  const match = session?.currentMatch;
  if (!session || !UUID.test(session.sessionId) || ![8, 16].includes(session.roundSize) ||
      !['IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED'].includes(session.status) ||
      !Number.isFinite(Date.parse(session.expiresAt)) || !progress ||
      !Number.isInteger(progress.completedMatches) || progress.completedMatches < 0 || progress.completedMatches > session.roundSize - 1 ||
      progress.totalMatches !== session.roundSize - 1) throw new Error('월드컵 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
  if (session.status === 'IN_PROGRESS') {
    if (!match || !UUID.test(match.id) || !isProduct(match.left) || !isProduct(match.right) || match.left.productId === match.right.productId ||
        ![2, 4, 8, 16].includes(progress.currentRoundSize ?? 0) || progress.currentRoundSize! > session.roundSize ||
        progress.roundMatchCount !== progress.currentRoundSize! / 2 || !Number.isInteger(progress.roundMatchNumber) ||
        progress.roundMatchNumber! < 1 || progress.roundMatchNumber! > progress.roundMatchCount! || session.winner !== null) {
      throw new Error('현재 경기 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
    }
  } else if (match !== null || progress.currentRoundSize !== null || progress.roundMatchNumber !== null || progress.roundMatchCount !== null ||
      (session.status === 'COMPLETED' ? !isProduct(session.winner) || progress.completedMatches !== progress.totalMatches : session.winner !== null)) {
    throw new Error('월드컵 결과 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
  }
  return session;
}

export function parseStartedWorldcup(value: unknown, roundSize: WorldcupRoundSize): WorldcupSession {
  const session = parseWorldcupSession(value);
  if (session.status !== 'IN_PROGRESS' || session.roundSize !== roundSize || session.progress.completedMatches !== 0 ||
      session.progress.currentRoundSize !== roundSize || session.progress.roundMatchNumber !== 1) {
    throw new Error('월드컵 시작 응답을 확인하지 못했습니다. 다시 시도해 주세요.');
  }
  return session;
}

async function readResponse(response: Response): Promise<any> {
  try { return await response.json(); } catch { return null; }
}

export async function startWorldcupSession(
  roundSize: WorldcupRoundSize,
  requestKey: string,
  signal?: AbortSignal,
): Promise<WorldcupSession> {
  const send = () => fetch('/api/worldcup/sessions', {
    method: 'POST',
    credentials: 'same-origin',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': requestKey },
    body: JSON.stringify({ roundSize }),
    signal,
  });
  let response = await send();
  let body = await readResponse(response);
  if (response.status === 428 && body?.error?.code === 'ANONYMOUS_SESSION_REQUIRED') {
    response = await send();
    body = await readResponse(response);
  }
  if (response.status === 428) {
    throw new Error('월드컵을 시작하려면 브라우저 쿠키를 허용해 주세요.');
  }
  if (response.status !== 200 && response.status !== 201) {
    throw new Error(typeof body?.error?.message === 'string' ? body.error.message : '월드컵을 시작하지 못했습니다. 다시 시도해 주세요.');
  }
  return parseStartedWorldcup(body, roundSize);
}

export async function getWorldcupSession(sessionId: string, signal?: AbortSignal): Promise<WorldcupSession> {
  const response = await fetch(`/api/worldcup/sessions/${sessionId}`, { cache: 'no-store', credentials: 'same-origin', signal });
  const body = await readResponse(response);
  if (!response.ok) throw new Error(typeof body?.error?.message === 'string' ? body.error.message : '진행 상황을 불러오지 못했습니다.');
  return parseWorldcupSession(body);
}

export async function voteWorldcup(sessionId: string, matchId: string, productId: string, signal?: AbortSignal): Promise<WorldcupSession> {
  const response = await fetch(`/api/worldcup/sessions/${sessionId}/matches/${matchId}/vote`, {
    method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ winnerProductId: productId }),
  });
  const body = await readResponse(response);
  if ((response.status === 409 && ['MATCH_ALREADY_DECIDED', 'MATCH_NOT_CURRENT'].includes(body?.error?.code)) || response.status === 410) {
    // Another tab may have advanced the game, or the session may have expired.
    return getWorldcupSession(sessionId, signal);
  }
  if (!response.ok) throw new Error(typeof body?.error?.message === 'string' ? body.error.message : '선택을 저장하지 못했습니다. 다시 시도해 주세요.');
  return parseWorldcupSession(body);
}

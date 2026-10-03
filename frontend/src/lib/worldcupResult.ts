export interface WorldcupMatch {
  /** 16, 8, 4, 2(결승) */
  round: number;
  winner: string;
  loser: string;
}

export interface WorldcupResultPayload {
  roundSize: 8 | 16;
  winnerBurgerId: string;
  matches: WorldcupMatch[];
}

const PENDING_KEY = 'bp_pending_worldcup';
/** 비로그인 결과는 로그인하러 다녀오는 동안만 보관한다 */
const PENDING_TTL_MS = 30 * 60 * 1000;

export async function submitWorldcupResult(payload: WorldcupResultPayload): Promise<void> {
  const res = await fetch('/api/worldcup/results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`월드컵 결과 저장 실패 (${res.status})`);
}

/** 비로그인 사용자가 끝낸 월드컵 결과를 로그인 후 저장하기 위해 잠시 보관 */
export function savePendingWorldcupResult(payload: WorldcupResultPayload): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ payload, savedAt: Date.now() }));
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)이면 보관하지 않는다.
  }
}

/**
 * 보관해 둔 결과가 있으면 저장하고 지운다. (로그인 상태에서만 호출)
 * @returns 저장했으면 true
 */
export async function flushPendingWorldcupResult(): Promise<boolean> {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    return false;
  }
  if (!raw) return false;

  try {
    const { payload, savedAt } = JSON.parse(raw) as {
      payload: WorldcupResultPayload;
      savedAt: number;
    };
    if (Date.now() - savedAt > PENDING_TTL_MS) return false;
    await submitWorldcupResult(payload);
    return true;
  } catch {
    return false;
  }
}

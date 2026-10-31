export type LandPoint = readonly [number, number];
export type LandPlaceId = 'arena' | 'factory' | 'lab' | 'hall';

export interface LandPlace {
  id: LandPlaceId;
  number: string;
  name: string;
  label: string;
  icon: string;
  description: string;
  activity: string;
  href: string;
  color: string;
  position: LandPoint;
  entrance: LandPoint;
}

export const LAND_RADIUS = 15;
export const LAND_PATH_LIMIT = 12;
export const LAND_ROAD_ROWS = [-2, 7] as const;

export const LAND_PLACES: readonly LandPlace[] = [
  { id: 'arena', number: '01', name: '버거 아레나', label: 'WORLD CUP', icon: '🏟️', description: '둘 중 더 끌리는 버거를 골라보세요. 마지막까지 살아남을 나의 최애 버거는?', activity: '햄버거 월드컵', href: '/', color: '#f3b94c', position: [-7, -4.9], entrance: [-7, -2] },
  { id: 'factory', number: '02', name: '버거 공장', label: 'STACK & PLAY', icon: '🍟', description: '주문서를 보고 차곡차곡! 제한 시간 안에 나만의 버거를 완성해 보세요.', activity: '햄버거 쌓기', href: '/game', color: '#f0907c', position: [7, -4.9], entrance: [7, -2] },
  { id: 'lab', number: '03', name: '취향 연구소', label: 'DISCOVER YOU', icon: '🔮', description: '버거를 고르는 순간 드러나는 나의 성격. 어떤 버거 유형인지 알아볼까요?', activity: '버거 심리테스트', href: '/burger-mbti', color: '#b9a5e5', position: [-7, 4.1], entrance: [-7, 7] },
  { id: 'hall', number: '04', name: '명예의 전당', label: 'HALL OF FAME', icon: '🏆', description: '모두의 선택을 받은 버거들을 만나보세요. 오늘의 인기 버거는 누구일까요?', activity: '월드컵 랭킹', href: '/ranking', color: '#a4c7df', position: [7, 4.1], entrance: [7, 7] },
];

export function landDestination(place: LandPlace): string {
  return `${place.href}?from=land`;
}

/** Walk along the central path before approaching an entrance, avoiding buildings. */
export function landWalkPath(start: LandPoint, entrance: LandPoint): LandPoint[] {
  if (Math.hypot(start[0] - entrance[0], start[1] - entrance[1]) <= .01) return [];
  const points: LandPoint[] = [[0, start[1]], [0, entrance[1]], entrance];
  let previous = start;
  return points.filter((point) => {
    const different = Math.hypot(point[0] - previous[0], point[1] - previous[1]) > .01;
    previous = point;
    return different;
  });
}

export function stepToward(start: LandPoint, target: LandPoint, distance: number): LandPoint {
  const length = Math.hypot(target[0] - start[0], target[1] - start[1]);
  if (length <= Math.max(0, distance)) return target;
  const ratio = Math.max(0, distance) / length;
  return [start[0] + (target[0] - start[0]) * ratio, start[1] + (target[1] - start[1]) * ratio];
}

export const LAND_KEYS: Readonly<Record<string, LandPoint>> = {
  ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1],
  ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0],
};

export function landKeyDirection(code: string, key: string): LandPoint | undefined {
  return LAND_KEYS[code] ?? LAND_KEYS[key] ?? LAND_KEYS[`Key${key.toUpperCase()}`];
}

/** Keep the player on the connected paths, clear of buildings and the island edge. */
export function isLandPath([x, z]: LandPoint): boolean {
  return (Math.abs(x) <= 1.05 && Math.abs(z) <= LAND_PATH_LIMIT)
    || (Math.abs(x) <= LAND_PATH_LIMIT && LAND_ROAD_ROWS.some((row) => Math.abs(z - row) <= 1.05))
    || Math.hypot(x, z - 1.6) <= 2.1;
}

export function moveOnLand(start: LandPoint, direction: LandPoint, distance: number): LandPoint {
  const length = Math.hypot(...direction);
  if (!length || distance <= 0) return start;
  // Substeps prevent skipping across a path edge on slow frames.
  const steps = Math.ceil(distance / .08);
  const dx = direction[0] / length * distance / steps;
  const dz = direction[1] / length * distance / steps;
  let [x, z] = start;
  for (let step = 0; step < steps; step++) {
    if (isLandPath([x + dx, z])) x += dx;
    if (isLandPath([x, z + dz])) z += dz;
  }
  return [x, z];
}

export function nearbyLandPlace(point: LandPoint): LandPlaceId | null {
  return LAND_PLACES.find((place) => Math.hypot(point[0] - place.entrance[0], point[1] - place.entrance[1]) <= .95)?.id ?? null;
}

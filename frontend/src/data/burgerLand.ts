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

// Includes clearance for the character around each building footprint.
export const LAND_BUILDING_CLEARANCE = 2.15;
export const LAND_WALK_RADIUS = LAND_RADIUS - .6;

/** All ground is walkable except building interiors and the island edge. */
export function isLandWalkable([x, z]: LandPoint): boolean {
  return Math.hypot(x, z) <= LAND_WALK_RADIUS
    && LAND_PLACES.every((place) => Math.abs(x - place.position[0]) >= LAND_BUILDING_CLEARANCE
      || Math.abs(z - place.position[1]) >= LAND_BUILDING_CLEARANCE);
}

/** Segment/box intersection prevents automatic walks from cutting through buildings. */
function clearLandSegment(start: LandPoint, end: LandPoint): boolean {
  return LAND_PLACES.every((place) => {
    let near = 0;
    let far = 1;
    for (const axis of [0, 1] as const) {
      const delta = end[axis] - start[axis];
      const min = place.position[axis] - LAND_BUILDING_CLEARANCE + 1e-7;
      const max = place.position[axis] + LAND_BUILDING_CLEARANCE - 1e-7;
      if (Math.abs(delta) < 1e-9) {
        if (start[axis] < min || start[axis] > max) return true;
      } else {
        const a = (min - start[axis]) / delta;
        const b = (max - start[axis]) / delta;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
        if (near > far) return true;
      }
    }
    return false;
  });
}

/** Find a short route across the grass, detouring around building corners. */
export function landWalkPath(start: LandPoint, entrance: LandPoint): LandPoint[] {
  if (Math.hypot(start[0] - entrance[0], start[1] - entrance[1]) <= .01) return [];
  if (!isLandWalkable(start) || !isLandWalkable(entrance)) return [];
  const margin = LAND_BUILDING_CLEARANCE + .08;
  const corners: LandPoint[] = LAND_PLACES.flatMap((place) =>
    [-1, 1].flatMap((x) => [-1, 1].map((z): LandPoint => [place.position[0] + x * margin, place.position[1] + z * margin])));
  const nodes = [start, entrance, ...corners.filter(isLandWalkable)];
  const distances = nodes.map(() => Infinity);
  const previous = nodes.map(() => -1);
  const visited = new Set<number>();
  distances[0] = 0;
  while (visited.size < nodes.length) {
    let current = -1;
    for (let i = 0; i < nodes.length; i++) {
      if (!visited.has(i) && (current === -1 || distances[i] < distances[current])) current = i;
    }
    if (current === -1 || !Number.isFinite(distances[current])) return [];
    if (current === 1) {
      const path: LandPoint[] = [];
      for (let i = 1; i !== 0; i = previous[i]) path.unshift(nodes[i]);
      return path;
    }
    visited.add(current);
    for (let i = 0; i < nodes.length; i++) {
      if (visited.has(i) || !clearLandSegment(nodes[current], nodes[i])) continue;
      const distance = distances[current] + Math.hypot(nodes[current][0] - nodes[i][0], nodes[current][1] - nodes[i][1]);
      if (distance < distances[i]) { distances[i] = distance; previous[i] = current; }
    }
  }
  return [];
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

export function moveOnLand(start: LandPoint, direction: LandPoint, distance: number): LandPoint {
  const length = Math.hypot(...direction);
  if (!length || distance <= 0) return start;
  // Substeps prevent skipping across a building or island edge on slow frames.
  const steps = Math.ceil(distance / .08);
  const dx = direction[0] / length * distance / steps;
  const dz = direction[1] / length * distance / steps;
  let [x, z] = start;
  for (let step = 0; step < steps; step++) {
    if (isLandWalkable([x + dx, z])) x += dx;
    if (isLandWalkable([x, z + dz])) z += dz;
  }
  return [x, z];
}

export function nearbyLandPlace(point: LandPoint): LandPlaceId | null {
  return LAND_PLACES.find((place) => Math.hypot(point[0] - place.entrance[0], point[1] - place.entrance[1]) <= .95)?.id ?? null;
}

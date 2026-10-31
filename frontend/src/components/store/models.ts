import * as THREE from 'three';

// 버거픽 매장의 3D 모델들. 외부 모델 파일 없이 기본 도형을 조합해서 만든다.

export const COLORS = {
  red: '#e8442c',
  yellow: '#ffcc2e',
  cream: '#fff7e6',
  tan: '#f0dcb4',
  ink: '#1a1a1a',
  wood: '#c98f55',
  woodDark: '#8a5a32',
  steel: '#c9ccd2',
};

const mat = (color: string, options: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, ...options });

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, castShadow = true) {
  const m = new THREE.Mesh(geometry, material);
  m.castShadow = castShadow;
  m.receiveShadow = true;
  return m;
}

// ─── 손님 캐릭터 (머리가 큰 귀여운 비율) ───
export type Avatar = {
  root: THREE.Group;
  body: THREE.Group; // 앉을 때 내려가고 걸을 때 통통 튐
  legL: THREE.Group;
  legR: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  hands: THREE.Group; // 쟁반을 드는 위치
};

export function createAvatar(shirt: string): Avatar {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = mat('#f6cfa8');
  const pants = mat('#3b4a6b');
  const shirtMat = mat(shirt);

  const limb = (length: number, radius: number, material: THREE.Material) => {
    const pivot = new THREE.Group();
    const m = mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), material);
    m.position.y = -length / 2 - radius * 0.3;
    pivot.add(m);
    return pivot;
  };

  const legL = limb(0.22, 0.085, pants);
  const legR = limb(0.22, 0.085, pants);
  legL.position.set(-0.1, 0.36, 0);
  legR.position.set(0.1, 0.36, 0);
  body.add(legL, legR);

  const torso = mesh(new THREE.CapsuleGeometry(0.2, 0.2, 8, 16), shirtMat);
  torso.position.y = 0.56;
  torso.scale.set(1, 1, 0.85);
  body.add(torso);

  const armL = limb(0.2, 0.065, shirtMat);
  const armR = limb(0.2, 0.065, shirtMat);
  armL.position.set(-0.27, 0.7, 0);
  armR.position.set(0.27, 0.7, 0);
  body.add(armL, armR);

  // 머리 + 머리카락 + 눈 + 볼
  const head = mesh(new THREE.SphereGeometry(0.3, 24, 18), skin);
  head.position.y = 1.02;
  body.add(head);
  const hair = mesh(new THREE.SphereGeometry(0.315, 24, 18, 0, Math.PI * 2, 0, Math.PI * 0.55), mat('#4a3020'));
  hair.position.y = 1.04;
  hair.rotation.x = -0.25;
  body.add(hair);
  for (const x of [-0.1, 0.1]) {
    const eye = mesh(new THREE.SphereGeometry(0.035, 12, 8), mat(COLORS.ink, { roughness: 0.3 }), false);
    eye.position.set(x, 1.0, 0.27);
    body.add(eye);
    const cheek = mesh(new THREE.SphereGeometry(0.045, 12, 8), mat('#ff9a8a'), false);
    cheek.position.set(x * 1.7, 0.94, 0.24);
    cheek.scale.set(1, 0.6, 0.4);
    body.add(cheek);
  }
  // 버거픽 모자
  const cap = mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.08, 20), mat(COLORS.red));
  cap.position.set(0, 1.3, 0.02);
  body.add(cap);
  const brim = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.025, 20, 1, false, -Math.PI / 2, Math.PI), mat(COLORS.red));
  brim.position.set(0, 1.27, 0.16);
  body.add(brim);

  // 발밑 그림자 (부드러운 원)
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.32, 24),
    new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.18, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.01;
  root.add(shadow);

  const hands = new THREE.Group();
  hands.position.set(0, 0.58, 0.32);
  body.add(hands);

  return { root, body, legL, legR, armL, armR, hands };
}

// ─── 버거 세트 (쟁반 + 버거 + 감자튀김 + 음료) ───
export type Meal = { tray: THREE.Group; burger: THREE.Group; fries: THREE.Group };

export function createMeal(): Meal {
  const tray = new THREE.Group();
  const plate = mesh(new THREE.BoxGeometry(0.5, 0.025, 0.34), mat(COLORS.red));
  tray.add(plate);
  const paper = mesh(new THREE.BoxGeometry(0.42, 0.005, 0.28), mat(COLORS.cream), false);
  paper.position.y = 0.015;
  tray.add(paper);

  // 버거: 아래빵 → 패티 → 치즈 → 양상추 → 위빵(참깨)
  const burger = new THREE.Group();
  const layer = (radius: number, height: number, color: string, y: number) => {
    const m = mesh(new THREE.CylinderGeometry(radius, radius, height, 24), mat(color));
    m.position.y = y;
    burger.add(m);
  };
  layer(0.075, 0.03, '#e8a24a', 0.015);
  layer(0.08, 0.028, '#5a2f1c', 0.044);
  const cheese = mesh(new THREE.BoxGeometry(0.15, 0.008, 0.15), mat(COLORS.yellow));
  cheese.position.y = 0.062;
  cheese.rotation.y = Math.PI / 4;
  burger.add(cheese);
  layer(0.085, 0.012, '#6cbf3c', 0.072);
  const top = mesh(new THREE.SphereGeometry(0.078, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat('#f2ad4e'));
  top.position.y = 0.078;
  top.scale.y = 0.75;
  burger.add(top);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const r = 0.035 + (i % 2) * 0.02;
    const seed = mesh(new THREE.SphereGeometry(0.006, 6, 4), mat('#fff4cf'), false);
    seed.position.set(Math.cos(a) * r, 0.118 - r * 0.35, Math.sin(a) * r);
    seed.scale.set(1.4, 0.6, 0.9);
    burger.add(seed);
  }
  burger.position.set(-0.1, 0.02, 0);
  tray.add(burger);

  // 감자튀김
  const fries = new THREE.Group();
  const box = mesh(new THREE.BoxGeometry(0.08, 0.09, 0.05), mat(COLORS.red));
  box.position.y = 0.045;
  fries.add(box);
  for (let i = 0; i < 7; i++) {
    const stick = mesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), mat(COLORS.yellow), false);
    stick.position.set(-0.028 + i * 0.009, 0.1 + (i % 3) * 0.01, (i % 2) * 0.012 - 0.006);
    stick.rotation.z = (i - 3) * 0.06;
    fries.add(stick);
  }
  fries.position.set(0.1, 0.02, -0.06);
  tray.add(fries);

  // 음료 컵 + 빨대
  const cup = mesh(new THREE.CylinderGeometry(0.04, 0.032, 0.13, 16), mat('#ffffff'));
  cup.position.set(0.14, 0.085, 0.07);
  tray.add(cup);
  const lid = mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.012, 16), mat(COLORS.red));
  lid.position.set(0.14, 0.155, 0.07);
  tray.add(lid);
  const straw = mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.09, 6), mat(COLORS.yellow), false);
  straw.position.set(0.15, 0.2, 0.07);
  straw.rotation.z = -0.2;
  tray.add(straw);

  return { tray, burger, fries };
}

// ─── 가구 ───
export function createTable(): THREE.Group {
  const g = new THREE.Group();
  const top = mesh(new THREE.BoxGeometry(1.1, 0.06, 0.8), mat(COLORS.cream));
  top.position.y = 0.75;
  g.add(top);
  const edge = mesh(new THREE.BoxGeometry(1.12, 0.03, 0.82), mat(COLORS.red));
  edge.position.y = 0.72;
  g.add(edge);
  const leg = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 10), mat(COLORS.steel, { metalness: 0.6, roughness: 0.4 }));
  leg.position.y = 0.36;
  g.add(leg);
  const foot = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.03, 20), mat(COLORS.steel, { metalness: 0.6, roughness: 0.4 }));
  foot.position.y = 0.015;
  g.add(foot);
  return g;
}

// 의자: 앞이 +z. 앉는 높이 0.45
export function createChair(color: string): THREE.Group {
  const g = new THREE.Group();
  const seat = mesh(new THREE.BoxGeometry(0.46, 0.08, 0.46), mat(color));
  seat.position.y = 0.45;
  g.add(seat);
  const back = mesh(new THREE.BoxGeometry(0.46, 0.5, 0.07), mat(color));
  back.position.set(0, 0.72, -0.2);
  g.add(back);
  const steel = mat(COLORS.steel, { metalness: 0.6, roughness: 0.4 });
  for (const [x, z] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const leg = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.42, 6), steel);
    leg.position.set(x, 0.21, z);
    g.add(leg);
  }
  return g;
}

// 창가 스툴: 앉는 높이 0.7
export function createStool(): THREE.Group {
  const g = new THREE.Group();
  const seat = mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.08, 20), mat(COLORS.red));
  seat.position.y = 0.7;
  g.add(seat);
  const pole = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.68, 8), mat(COLORS.steel, { metalness: 0.6, roughness: 0.4 }));
  pole.position.y = 0.34;
  g.add(pole);
  const foot = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 20), mat(COLORS.steel, { metalness: 0.6, roughness: 0.4 }));
  foot.position.y = 0.015;
  g.add(foot);
  return g;
}

export function createKiosk(): THREE.Group {
  const g = new THREE.Group();
  const stand = mesh(new THREE.BoxGeometry(0.6, 1.7, 0.18), mat('#f4f4f4'));
  stand.position.y = 0.85;
  g.add(stand);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.8), new THREE.MeshBasicMaterial({ map: kioskTexture() }));
  screen.position.set(0, 1.12, 0.095);
  g.add(screen);
  const band = mesh(new THREE.BoxGeometry(0.62, 0.12, 0.2), mat(COLORS.red));
  band.position.y = 1.65;
  g.add(band);
  return g;
}

function kioskTexture() {
  const c = document.createElement('canvas');
  c.width = 240;
  c.height = 400;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = COLORS.cream;
  ctx.fillRect(0, 0, 240, 400);
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(0, 0, 240, 70);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 30px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('주문하기', 120, 47);
  ctx.font = '70px sans-serif';
  ctx.fillText('🍔', 120, 200);
  ctx.fillStyle = COLORS.ink;
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('여기를 눌러', 120, 290);
  ctx.fillText('주문하세요', 120, 325);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function menuBoardTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 320;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(0, 0, 1024, 320);
  ctx.fillStyle = COLORS.yellow;
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('BURGER PICK', 40, 86);
  ctx.fillStyle = COLORS.red;
  ctx.fillRect(40, 108, 944, 6);
  ctx.font = 'bold 38px sans-serif';
  const items = [
    ['오늘의 버거', '?,???'],
    ['감자튀김', '2,000'],
    ['콜라', '1,800'],
    ['버거 세트', '+2,500'],
  ];
  items.forEach(([name, price], i) => {
    const x = 40 + (i % 2) * 490;
    const y = 180 + Math.floor(i / 2) * 70;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, x, y);
    ctx.fillStyle = COLORS.yellow;
    ctx.textAlign = 'right';
    ctx.fillText(price, x + 440, y);
    ctx.textAlign = 'left';
  });
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function signTexture(text: string, bg: string, fg: string) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg;
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export { mat, mesh };

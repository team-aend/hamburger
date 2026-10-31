import * as THREE from 'three';
import {
  COLORS,
  createAvatar,
  createChair,
  createKiosk,
  createMeal,
  createStool,
  createTable,
  mat,
  menuBoardTexture,
  mesh,
  signTexture,
  type Avatar,
  type Meal,
} from './models';

// 버거픽 매장 3D 월드: 매장 만들기, 캐릭터 이동·앉기·먹기, 탭 입력, 카메라
//
// 좌표: x 오른쪽, z 앞쪽(입구), y 위. 카운터는 뒤쪽(z = -7), 입구는 앞쪽(z = +9)
// 이동은 테이블에 부딪히지 않게 정해진 길(가로 통로 AISLES_Z, 세로 통로 LANES_X)로만 다닌다.

const AISLES_Z = [-4.4, -1, 2, 5, 8.3];
const LANES_X = [-6, 0, 6.2];
const WALK_SPEED = 2.8; // m/s

export type Spot = 'none' | 'seat' | 'kiosk' | 'pickup';

export type AvatarState = {
  mode: 'walking' | 'standing' | 'sitting';
  spot: Spot;
  carrying: boolean; // 쟁반을 들고 있음
  mealOnTable: boolean; // 내 자리 테이블에 음식이 있음
  bitesLeft: number;
};

type Seat = {
  id: string;
  position: THREE.Vector3; // 앉는 자리 (바닥 기준)
  yaw: number; // 앉았을 때 바라보는 방향
  seatY: number;
  approach: THREE.Vector3; // 통로 위 출입 지점
  trayAt: THREE.Vector3; // 음식을 내려놓는 곳
};

type Target = { approach: THREE.Vector3; final: THREE.Vector3; spot: Spot; seat?: Seat; faceYaw?: number };

export type WorldCallbacks = {
  onState: (state: AvatarState) => void;
  onArriveKiosk: () => void;
  onPickedUp: () => void;
  onBite: (left: number) => void;
};

const BITES = 4;

export class StoreWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(55, 1, 0.1, 80);
  private clock = new THREE.Clock();
  private raycaster = new THREE.Raycaster();
  private interactive: THREE.Object3D[] = [];
  private seats: Seat[] = [];
  private kiosks: Target[] = [];
  private pickup!: Target;

  private avatar: Avatar;
  private meal: Meal | null = null; // 카운터 → 손 → 테이블로 옮겨 다니는 내 음식
  private path: THREE.Vector3[] = [];
  private pending: Target | null = null;
  private state: AvatarState = { mode: 'standing', spot: 'none', carrying: false, mealOnTable: false, bitesLeft: 0 };
  private currentSeat: Seat | null = null;
  private waveUntil = 0;
  private biteAnim = 0;
  private camYaw = 0; // 드래그로 돌리는 카메라 각도
  private drag: { x: number; y: number; yaw: number; moved: boolean } | null = null;
  private raf = 0;
  private disposed = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private callbacks: WorldCallbacks,
  ) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color('#f7e9d2');
    this.scene.fog = new THREE.Fog('#f7e9d2', 18, 34);

    this.buildStore();
    this.avatar = createAvatar(['#4f8edc', '#3aa66b', '#f2a03d', '#9b6bd6'][Math.floor(Math.random() * 4)]);
    this.avatar.root.position.set(0, 0, 8.3);
    this.avatar.root.rotation.y = Math.PI; // 입구에서 카운터 쪽을 보며 시작
    this.camYaw = Math.PI;
    this.scene.add(this.avatar.root);

    this.resize();
    this.updateCamera(1); // 처음부터 캐릭터 뒤에서 시작 (원점에서 날아오지 않게)
    window.addEventListener('resize', this.resize);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    this.loop();
    this.emit();
  }

  // ─── 매장 만들기 ───
  private buildStore() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#fff6e0', '#c9a27a', 1.4));
    const sun = new THREE.DirectionalLight('#fff1d6', 1.6);
    sun.position.set(-6, 12, 6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -11, right: 11, top: 12, bottom: -12, near: 1, far: 30 });
    s.add(sun);

    // 바닥: 크림·연갈색 체크 타일
    const tiles = document.createElement('canvas');
    tiles.width = tiles.height = 128;
    const t = tiles.getContext('2d')!;
    for (let y = 0; y < 2; y++)
      for (let x = 0; x < 2; x++) {
        t.fillStyle = (x + y) % 2 ? '#efdcb8' : '#fbf1de';
        t.fillRect(x * 64, y * 64, 64, 64);
      }
    const floorTex = new THREE.CanvasTexture(tiles);
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(8, 10);
    floorTex.colorSpace = THREE.SRGBColorSpace;
    const floor = mesh(new THREE.PlaneGeometry(16, 20), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 }), false);
    floor.rotation.x = -Math.PI / 2;
    floor.userData.floor = true;
    s.add(floor);
    this.interactive.push(floor);

    // 벽: 뒤(빨강·크림), 왼쪽(창문), 오른쪽
    const wall = (w: number, h: number, color: string) => mesh(new THREE.PlaneGeometry(w, h), mat(color), false);
    const back = wall(16, 4.5, COLORS.cream);
    back.position.set(0, 2.25, -10);
    s.add(back);
    const backStripe = mesh(new THREE.BoxGeometry(16, 0.5, 0.05), mat(COLORS.red), false);
    backStripe.position.set(0, 3.9, -9.97);
    s.add(backStripe);
    const left = wall(20, 4.5, '#fff1d8');
    left.rotation.y = Math.PI / 2;
    left.position.set(-8, 2.25, 0);
    s.add(left);
    const right = wall(20, 4.5, '#fff1d8');
    right.rotation.y = -Math.PI / 2;
    right.position.set(8, 2.25, 0);
    s.add(right);
    const wainscot = (x: number, rot: number) => {
      const m = mesh(new THREE.BoxGeometry(20, 1, 0.05), mat(COLORS.red), false);
      m.rotation.y = rot;
      m.position.set(x, 0.5, 0);
      s.add(m);
    };
    wainscot(-7.97, Math.PI / 2);
    wainscot(7.97, -Math.PI / 2);

    // 왼쪽 창문 + 창가 바 테이블
    for (const z of [-3, 1, 5]) {
      const glass = new THREE.Mesh(
        new THREE.PlaneGeometry(3.2, 1.6),
        new THREE.MeshBasicMaterial({ color: '#bfe6ff' }),
      );
      glass.rotation.y = Math.PI / 2;
      glass.position.set(-7.96, 2.1, z);
      s.add(glass);
      const frame = mesh(new THREE.BoxGeometry(0.06, 1.7, 0.1), mat(COLORS.ink), false);
      frame.position.set(-7.94, 2.1, z);
      s.add(frame);
    }
    const bar = mesh(new THREE.BoxGeometry(0.6, 0.06, 11), mat(COLORS.wood));
    bar.position.set(-7.65, 1.05, 1.5);
    s.add(bar);

    // 카운터 + 메뉴판 + 주방
    const counter = mesh(new THREE.BoxGeometry(10, 1.1, 1), mat(COLORS.red));
    counter.position.set(-1, 0.55, -7.2);
    s.add(counter);
    const counterTop = mesh(new THREE.BoxGeometry(10.2, 0.06, 1.15), mat(COLORS.cream));
    counterTop.position.set(-1, 1.13, -7.2);
    s.add(counterTop);
    const stripe = mesh(new THREE.BoxGeometry(10.02, 0.12, 0.02), mat(COLORS.yellow), false);
    stripe.position.set(-1, 0.75, -6.69);
    s.add(stripe);
    for (const x of [-4, -1.5]) {
      const register = mesh(new THREE.BoxGeometry(0.4, 0.3, 0.35), mat('#3b3b40'));
      register.position.set(x, 1.31, -7.3);
      s.add(register);
    }
    const board = new THREE.Mesh(new THREE.PlaneGeometry(7, 2.2), new THREE.MeshBasicMaterial({ map: menuBoardTexture() }));
    board.position.set(-1, 2.9, -9.95);
    s.add(board);
    const kitchen = mesh(new THREE.BoxGeometry(9, 1.6, 0.8), mat(COLORS.steel, { metalness: 0.5, roughness: 0.4 }));
    kitchen.position.set(-1, 0.8, -9.4);
    s.add(kitchen);

    // 픽업대 (주문한 음식이 나오는 곳)
    const pickupDesk = mesh(new THREE.BoxGeometry(1.6, 1.1, 1), mat(COLORS.yellow));
    pickupDesk.position.set(4.8, 0.55, -7.2);
    pickupDesk.userData.pickup = true;
    s.add(pickupDesk);
    this.interactive.push(pickupDesk);
    const pickupSign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: signTexture('PICK UP', COLORS.ink, COLORS.yellow) }));
    pickupSign.position.set(4.8, 2.0, -7.6);
    s.add(pickupSign);
    this.pickup = { approach: new THREE.Vector3(4.8, 0, AISLES_Z[0]), final: new THREE.Vector3(4.8, 0, -6.2), spot: 'pickup', faceYaw: Math.PI };

    // 키오스크 2대 (오른쪽 벽)
    for (const z of [-5.6, -3.4]) {
      const k = createKiosk();
      k.position.set(7.4, 0, z);
      k.rotation.y = -Math.PI / 2;
      k.traverse((o) => (o.userData.kiosk = true));
      s.add(k);
      this.interactive.push(k);
      this.kiosks.push({ approach: new THREE.Vector3(6.2, 0, AISLES_Z[0]), final: new THREE.Vector3(6.55, 0, z), spot: 'kiosk', faceYaw: Math.PI / 2 });
    }

    // 2인용 테이블: 왼쪽 열(x=-3.6), 오른쪽 열(x=3.4) × 4줄
    const chairColors = [COLORS.red, COLORS.yellow];
    let n = 0;
    for (const tz of [-2.5, 0.5, 3.5, 6.5]) {
      const aisle = AISLES_Z.find((z) => z > tz)!; // 테이블 바로 앞 통로
      for (const tx of [-3.6, 3.4]) {
        const table = createTable();
        table.position.set(tx, 0, tz);
        s.add(table);
        for (const side of [-1, 1]) {
          const cx = tx + side * 0.95;
          const chair = createChair(chairColors[n++ % 2]);
          chair.position.set(cx, 0, tz);
          chair.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; // 테이블을 보게
          s.add(chair);
          const seat: Seat = {
            id: `t${tx}${tz}${side}`,
            position: new THREE.Vector3(cx - side * 0.04, 0, tz),
            yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2,
            seatY: 0.45,
            approach: new THREE.Vector3(cx, 0, aisle),
            trayAt: new THREE.Vector3(tx + side * 0.27, 0.79, tz),
          };
          chair.traverse((o) => (o.userData.seatId = seat.id));
          this.interactive.push(chair);
          this.seats.push(seat);
        }
      }
    }

    // 창가 스툴 (창밖을 보며 앉기)
    for (const z of [-2.5, -0.5, 1.5, 3.5, 5.5]) {
      const stool = createStool();
      stool.position.set(-6.9, 0, z);
      s.add(stool);
      const seat: Seat = {
        id: `w${z}`,
        position: new THREE.Vector3(-6.95, 0, z),
        yaw: -Math.PI / 2,
        seatY: 0.7,
        approach: new THREE.Vector3(LANES_X[0], 0, z),
        trayAt: new THREE.Vector3(-7.62, 1.09, z),
      };
      stool.traverse((o) => (o.userData.seatId = seat.id));
      this.interactive.push(stool);
      this.seats.push(seat);
    }

    // 입구 매트 + 간판
    const mat0 = mesh(new THREE.PlaneGeometry(2.4, 1.2), mat(COLORS.red), false);
    mat0.rotation.x = -Math.PI / 2;
    mat0.position.set(0, 0.005, 9.2);
    s.add(mat0);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75), new THREE.MeshBasicMaterial({ map: signTexture('BURGER PICK', COLORS.red, '#ffffff') }));
    logo.position.set(-1, 4.3, -9.94);
    s.add(logo);
  }

  // ─── 외부(React)에서 부르는 동작 ───

  goToKiosk() {
    const here = this.avatar.root.position;
    const nearest = this.kiosks.reduce((a, b) => (a.final.distanceTo(here) < b.final.distanceTo(here) ? a : b));
    this.walkTo(nearest);
  }

  goToPickup() {
    this.walkTo(this.pickup);
  }

  /** 주문한 음식이 픽업대에 나옴 */
  serveMeal() {
    this.clearMeal();
    this.meal = createMeal();
    this.meal.tray.position.set(4.8, 1.13, -7.0);
    this.meal.tray.rotation.y = Math.PI / 2;
    this.scene.add(this.meal.tray);
  }

  wave() {
    this.waveUntil = this.clock.elapsedTime + 1.6;
  }

  /** 한 입 먹기. 다 먹으면 쟁반이 사라짐 */
  bite() {
    if (!this.meal || !this.state.mealOnTable || this.state.bitesLeft <= 0) return;
    this.biteAnim = 1;
    this.state.bitesLeft--;
    const left = this.state.bitesLeft;
    const k = 0.25 + (left / BITES) * 0.75;
    this.meal.burger.scale.setScalar(k);
    this.meal.fries.scale.setScalar(0.3 + (left / BITES) * 0.7);
    if (left === 0) {
      setTimeout(() => {
        this.clearMeal();
        this.state.mealOnTable = false;
        this.emit();
      }, 900);
    }
    this.callbacks.onBite(left);
    this.emit();
  }

  standUp() {
    if (this.state.mode !== 'sitting' || !this.currentSeat) return;
    const seat = this.currentSeat;
    this.currentSeat = null;
    this.avatar.root.position.copy(seat.position);
    this.path = [seat.approach.clone()];
    this.pending = null;
    this.setMode('walking', 'none');
    if (this.state.mealOnTable) {
      // 남은 음식은 테이블에 두고 일어남 (다시 앉으면 이어 먹기는 다음 단계)
      this.clearMeal();
      this.state.mealOnTable = false;
    }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.renderer.dispose();
  }

  /** 이름표를 띄울 화면 좌표 (머리 위) */
  headScreenPosition(): { x: number; y: number } | null {
    const p = new THREE.Vector3();
    this.avatar.body.getWorldPosition(p);
    p.y += 1.55;
    p.project(this.camera);
    if (p.z > 1) return null;
    const rect = this.canvas.getBoundingClientRect();
    return { x: ((p.x + 1) / 2) * rect.width, y: ((1 - p.y) / 2) * rect.height };
  }

  // ─── 이동 ───

  private walkTo(target: Target) {
    if (this.state.mode === 'sitting') this.standUp();
    const from = this.state.mode === 'walking' && this.path.length ? this.path[0] : this.avatar.root.position.clone();
    const start = this.currentStopApproach(from);
    this.path = [...this.route(start, target.approach), target.final.clone()];
    if (start.distanceTo(from) > 0.05) this.path.unshift(start);
    this.pending = target;
    this.setMode('walking', 'none');
  }

  // 지금 서 있는 곳이 통로가 아니면(키오스크 앞 등) 가장 가까운 통로 지점부터 출발
  private currentStopApproach(p: THREE.Vector3) {
    const z = AISLES_Z.reduce((a, b) => (Math.abs(b - p.z) < Math.abs(a - p.z) ? b : a));
    if (Math.abs(z - p.z) < 0.05) return p.clone();
    const spot = [this.pickup, ...this.kiosks].find((t) => t.final.distanceTo(p) < 0.3);
    return spot ? spot.approach.clone() : new THREE.Vector3(p.x, 0, z);
  }

  // 통로 → 세로 통로 → 목표 통로 순서로 꺾어서 이동 (테이블을 피함)
  private route(from: THREE.Vector3, to: THREE.Vector3): THREE.Vector3[] {
    if (Math.abs(from.z - to.z) < 0.05) return [to.clone()];
    const mid = (from.x + to.x) / 2;
    const lane = LANES_X.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a));
    return [new THREE.Vector3(lane, 0, from.z), new THREE.Vector3(lane, 0, to.z), to.clone()];
  }

  private arrive() {
    const target = this.pending;
    this.pending = null;
    if (!target) {
      this.setMode('standing', 'none');
      return;
    }
    if (target.faceYaw !== undefined) this.avatar.root.rotation.y = target.faceYaw;

    if (target.spot === 'seat' && target.seat) {
      const seat = target.seat;
      this.currentSeat = seat;
      this.avatar.root.position.set(seat.position.x, seat.seatY - 0.3, seat.position.z);
      this.avatar.root.rotation.y = seat.yaw;
      // 쟁반을 들고 왔으면 테이블에 내려놓기
      if (this.state.carrying && this.meal) {
        this.avatar.hands.remove(this.meal.tray);
        this.meal.tray.position.copy(seat.trayAt);
        this.meal.tray.rotation.set(0, seat.yaw, 0);
        this.scene.add(this.meal.tray);
        this.state.carrying = false;
        this.state.mealOnTable = true;
        this.state.bitesLeft = BITES;
      }
      this.setMode('sitting', 'seat');
      return;
    }
    if (target.spot === 'kiosk') {
      this.setMode('standing', 'kiosk');
      this.callbacks.onArriveKiosk();
      return;
    }
    if (target.spot === 'pickup') {
      this.setMode('standing', 'pickup');
      if (this.meal && !this.state.carrying && !this.state.mealOnTable) {
        this.scene.remove(this.meal.tray);
        this.meal.tray.position.set(0, 0, 0);
        this.meal.tray.rotation.set(0, 0, 0);
        this.avatar.hands.add(this.meal.tray);
        this.state.carrying = true;
        this.callbacks.onPickedUp();
        this.emit();
      }
      return;
    }
    this.setMode('standing', 'none');
  }

  // ─── 탭 입력 (짧게 누르면 탭, 끌면 카메라 회전) ───

  private onPointerDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { x: e.clientX, y: e.clientY, yaw: this.camYaw, moved: false };
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.drag) return;
    const dx = e.clientX - this.drag.x;
    if (Math.abs(dx) > 8 || Math.abs(e.clientY - this.drag.y) > 8) this.drag.moved = true;
    if (this.drag.moved) this.camYaw = this.drag.yaw - dx * 0.008;
  };

  private onPointerUp = (e: PointerEvent) => {
    const drag = this.drag;
    this.drag = null;
    if (!drag || drag.moved) return;
    this.tap(e.clientX, e.clientY);
  };

  private onPointerCancel = () => {
    this.drag = null;
  };

  private tap(clientX: number, clientY: number) {
    const rect = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.interactive, true)[0];
    if (!hit) return;
    const data = hit.object.userData;

    if (data.seatId) {
      const seat = this.seats.find((s) => s.id === data.seatId)!;
      if (this.currentSeat?.id === seat.id) return;
      this.walkTo({ approach: seat.approach, final: seat.position.clone(), spot: 'seat', seat });
    } else if (data.kiosk) {
      this.goToKiosk();
    } else if (data.pickup) {
      this.goToPickup();
    } else if (data.floor) {
      // 바닥을 누르면 가장 가까운 통로의 그 위치로 걸어감
      const z = AISLES_Z.reduce((a, b) => (Math.abs(b - hit.point.z) < Math.abs(a - hit.point.z) ? b : a));
      const x = THREE.MathUtils.clamp(hit.point.x, -6, 6.2);
      const point = new THREE.Vector3(x, 0, z);
      this.walkTo({ approach: point, final: point, spot: 'none' });
    }
  }

  // ─── 매 프레임 ───

  private loop = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    // 느린 기기에서도 걷기가 슬로모션이 되지 않게 프레임 간격을 넉넉히 허용 (탭 전환 후 순간이동만 막음)
    const dt = Math.min(this.clock.getDelta(), 0.25);
    const t = this.clock.elapsedTime;
    this.updateWalk(dt);
    this.animate(t, dt);
    this.updateCamera(dt);
    this.renderer.render(this.scene, this.camera);
  };

  private updateWalk(dt: number) {
    if (this.state.mode !== 'walking') return;
    const pos = this.avatar.root.position;
    pos.y = 0;
    let step = WALK_SPEED * dt;
    while (step > 0 && this.path.length) {
      const next = this.path[0];
      const d = next.clone().sub(pos);
      d.y = 0;
      const dist = d.length();
      if (dist > 0.001) {
        const want = Math.atan2(d.x, d.z);
        const r = this.avatar.root.rotation;
        r.y += Math.atan2(Math.sin(want - r.y), Math.cos(want - r.y)) * Math.min(1, dt * 12);
      }
      if (dist <= step) {
        pos.copy(next);
        step -= dist;
        this.path.shift();
      } else {
        pos.add(d.multiplyScalar(step / dist));
        step = 0;
      }
    }
    if (!this.path.length) this.arrive();
  }

  private animate(t: number, dt: number) {
    const a = this.avatar;
    const walking = this.state.mode === 'walking';
    const sitting = this.state.mode === 'sitting';
    const swing = walking ? Math.sin(t * 11) * 0.6 : 0;
    const ease = (cur: number, to: number) => cur + (to - cur) * Math.min(1, dt * 14);

    a.legL.rotation.x = ease(a.legL.rotation.x, sitting ? -Math.PI / 2 : swing);
    a.legR.rotation.x = ease(a.legR.rotation.x, sitting ? -Math.PI / 2 : -swing);
    a.body.position.y = walking ? Math.abs(Math.sin(t * 11)) * 0.05 : 0;

    // 팔: 쟁반 들기 > 먹기 > 손 흔들기 > 걷기 흔들기
    const waving = t < this.waveUntil;
    let armRx = walking ? swing * 0.8 : 0;
    let armLx = walking ? -swing * 0.8 : 0;
    let armRz = 0;
    if (this.state.carrying) {
      armRx = armLx = -1.25;
    } else if (this.biteAnim > 0) {
      armRx = -2.2 * Math.sin(this.biteAnim * Math.PI);
      this.biteAnim = Math.max(0, this.biteAnim - dt * 2.2);
    } else if (waving) {
      armRz = 2.7 + Math.sin(t * 14) * 0.35;
      armRx = 0;
    }
    a.armR.rotation.x = ease(a.armR.rotation.x, armRx);
    a.armL.rotation.x = ease(a.armL.rotation.x, armLx);
    a.armR.rotation.z = ease(a.armR.rotation.z, armRz);
    a.armL.rotation.z = ease(a.armL.rotation.z, 0);
  }

  // 캐릭터 뒤에서 따라가는 카메라 (앉으면 조금 더 위에서)
  private updateCamera(dt: number) {
    const target = this.avatar.root.position;
    const sitting = this.state.mode === 'sitting';
    const dist = sitting ? 3.4 : 4.4;
    const height = sitting ? 2.6 : 2.7;
    const want = new THREE.Vector3(target.x - Math.sin(this.camYaw) * dist, height + (sitting ? 0.3 : 0), target.z - Math.cos(this.camYaw) * dist);
    // 카메라가 벽·카운터 뒤로 넘어가지 않게 매장 안쪽으로 제한 (앞쪽 입구 방향은 열려 있음)
    want.x = THREE.MathUtils.clamp(want.x, -7.4, 7.4);
    want.z = THREE.MathUtils.clamp(want.z, -5.6, 13);
    this.camera.position.lerp(want, Math.min(1, dt * 4));
    const look = new THREE.Vector3(target.x, target.y + (sitting ? 0.9 : 1.0), target.z);
    this.camera.lookAt(look);
    // 걷는 동안엔 카메라가 캐릭터 뒤로 천천히 돌아감 (드래그 중이 아닐 때)
    if (this.state.mode === 'walking' && !this.drag) {
      const r = this.avatar.root.rotation.y;
      this.camYaw += Math.atan2(Math.sin(r - this.camYaw), Math.cos(r - this.camYaw)) * Math.min(1, dt * 1.5);
    }
  }

  private resize = () => {
    const { clientWidth: w, clientHeight: h } = this.canvas;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.fov = w < h ? 62 : 50; // 세로 화면(폰)은 조금 더 넓게
    this.camera.updateProjectionMatrix();
  };

  private setMode(mode: AvatarState['mode'], spot: Spot) {
    this.state.mode = mode;
    this.state.spot = spot;
    this.emit();
  }

  private clearMeal() {
    if (!this.meal) return;
    this.meal.tray.removeFromParent();
    this.meal = null;
  }

  private emit() {
    this.callbacks.onState({ ...this.state });
  }
}

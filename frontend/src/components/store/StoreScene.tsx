'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { AvatarState, StoreWorld } from './world';
import styles from './StoreScene.module.css';

// 버거픽 매장 화면: 3D 월드(world.ts) 위에 상단 바 · 이름표 · 동작 버튼 · 키오스크 주문 화면을 얹는다.

type MenuItem = { id: number; name: string; brand: string; price: number | null; imageUrl: string | null };

type Order =
  | { status: 'none' }
  | { status: 'cooking' | 'ready' | 'carrying' | 'eating'; number: number; item: MenuItem };

const NICKNAMES = ['배고픈 감자튀김', '바삭한 너겟', '수줍은 피클', '든든한 패티', '달콤한 쉐이크', '졸린 양상추', '용감한 치즈'];
const COOK_MS = 6000;

export default function StoreScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tagRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<StoreWorld | null>(null);
  const [state, setState] = useState<AvatarState | null>(null);
  const [order, setOrder] = useState<Order>({ status: 'none' });
  const [kioskOpen, setKioskOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [waving, setWaving] = useState(false);
  const [sound, setSound] = useState(true);
  // 닉네임은 브라우저에서 고른다 (서버와 브라우저가 서로 다른 랜덤 값을 그리면 화면 불일치 에러)
  const [nickname, setNickname] = useState('');
  useEffect(() => setNickname(NICKNAMES[Math.floor(Math.random() * NICKNAMES.length)]), []);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const toastTimer = useRef(0);
  const showToast = useCallback((message: string, ms = 2600) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), ms);
  }, []);

  // 3D 월드는 브라우저에서만 (three.js 는 서버 렌더링 불가) → 화면에 붙은 뒤 불러온다
  useEffect(() => {
    let world: StoreWorld | null = null;
    let raf = 0;
    let cancelled = false;
    import('./world').then(({ StoreWorld }) => {
      if (cancelled || !canvasRef.current) return;
      world = new StoreWorld(canvasRef.current, {
        onState: setState,
        onArriveKiosk: () => setKioskOpen(true),
        onPickedUp: () => {
          setOrder((o) => (o.status === 'ready' ? { ...o, status: 'carrying' } : o));
          showToast('쟁반을 받았어요! 빈자리를 눌러 앉아 보세요');
        },
        onBite: (left) => {
          if (soundRef.current) playBite();
          if (left === 0) {
            setOrder({ status: 'none' });
            showToast('잘 먹었습니다! 😋');
          }
        },
      });
      worldRef.current = world;
      // 개발 모드에서만 콘솔·자동 테스트용으로 열어 둠 (배포 빌드에서는 빠짐)
      if (process.env.NODE_ENV === 'development') (window as unknown as { __store?: StoreWorld }).__store = world;
      // 이름표가 머리 위를 따라다니게
      const follow = () => {
        raf = requestAnimationFrame(follow);
        const p = world?.headScreenPosition();
        const tag = tagRef.current;
        if (!tag) return;
        tag.style.opacity = p ? '1' : '0';
        if (p) tag.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`;
      };
      follow();
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      world?.dispose();
      worldRef.current = null;
    };
  }, [showToast]);

  // 자리에 앉으면서 쟁반을 내려놓으면 먹기 단계로
  useEffect(() => {
    if (state?.mealOnTable) setOrder((o) => (o.status === 'carrying' ? { ...o, status: 'eating' } : o));
  }, [state?.mealOnTable]);

  // 손 흔들기: 캐릭터가 팔을 흔들고, 등 돌린 방향이어도 보이게 머리 위에 👋 말풍선
  const wave = () => {
    worldRef.current?.wave();
    setWaving(true);
    window.setTimeout(() => setWaving(false), 1600);
  };

  const placeOrder = (item: MenuItem) => {
    const number = 10 + Math.floor(Math.random() * 90);
    setKioskOpen(false);
    setOrder({ status: 'cooking', number, item });
    showToast(`주문 완료! 주문번호 ${number}번 · 잠시만 기다려 주세요`, 3200);
    window.setTimeout(() => {
      worldRef.current?.serveMeal();
      setOrder((o) => (o.status === 'cooking' && o.number === number ? { ...o, status: 'ready' } : o));
      if (soundRef.current) playBell();
      showToast(`${number}번 고객님~ ${item.name} 나왔습니다! 픽업대에서 받아 가세요`, 4200);
    }, COOK_MS);
  };

  const sitting = state?.mode === 'sitting';
  const hint =
    order.status === 'carrying'
      ? '빈자리를 누르면 앉으면서 쟁반을 내려놓아요'
      : order.status === 'cooking'
        ? `${order.number}번 · 조리 중이에요… 자리에 앉아서 기다려도 돼요`
        : sitting
          ? null
          : '의자를 누르면 앉아요 · 화면을 옆으로 끌면 둘러보기';

  return (
    <div className={styles.root}>
      <canvas ref={canvasRef} className={styles.canvas} />

      <header className={styles.top}>
        <Link href="/" className={styles.iconButton} aria-label="매장 나가기">
          ⟵
        </Link>
        <div className={styles.place}>
          <b>버거픽 1호점</b>
          <span>혼자 영업 중</span>
        </div>
        <button className={styles.iconButton} type="button" onClick={() => setSound((s) => !s)} aria-label={sound ? '소리 끄기' : '소리 켜기'}>
          {sound ? '🔊' : '🔇'}
        </button>
      </header>

      <div ref={tagRef} className={styles.nameTag}>
        {waving && <b className={styles.bubble}>👋</b>}
        <span>나</span> {nickname}
      </div>

      {toast && (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      )}

      {hint && <p className={styles.hint}>{hint}</p>}

      <nav className={styles.actions} aria-label="동작">
        {sitting ? (
          <>
            <button type="button" disabled={!state?.mealOnTable} onClick={() => worldRef.current?.bite()}>
              <span>🍔</span>
              {state?.mealOnTable ? `먹기 · ${state.bitesLeft}` : '먹기'}
            </button>
            <button type="button" onClick={wave}>
              <span>👋</span>손 흔들기
            </button>
            <button type="button" onClick={() => worldRef.current?.standUp()}>
              <span>🚶</span>일어서기
            </button>
          </>
        ) : (
          <>
            {order.status === 'ready' && !state?.carrying ? (
              <button type="button" className={styles.primary} onClick={() => worldRef.current?.goToPickup()}>
                <span>🛎️</span>음식 받기
              </button>
            ) : (
              <button
                type="button"
                disabled={order.status !== 'none'}
                onClick={() => worldRef.current?.goToKiosk()}
              >
                <span>🧾</span>주문하기
              </button>
            )}
            <button type="button" onClick={wave}>
              <span>👋</span>손 흔들기
            </button>
          </>
        )}
      </nav>

      {kioskOpen && <Kiosk onClose={() => setKioskOpen(false)} onOrder={placeOrder} />}
    </div>
  );
}

// ─── 키오스크: 버거픽 실제 상품으로 주문 ───
function Kiosk({ onClose, onOrder }: { onClose: () => void; onOrder: (item: MenuItem) => void }) {
  const [items, setItems] = useState<MenuItem[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let ignore = false;
    fetch('/api/recommend', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: { items?: RecommendItem[] }) => {
        if (ignore) return;
        // 매번 다른 메뉴 8개. 사진이 있는 상품(아직 일부만 있음)을 먼저 보여준다
        const all = (data.items ?? []).map(toMenuItem).sort(() => Math.random() - 0.5);
        const withImage = all.filter((item) => item.imageUrl);
        const withoutImage = all.filter((item) => !item.imageUrl);
        setItems([...withImage, ...withoutImage].slice(0, 8));
      })
      .catch(() => !ignore && setError(true));
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className={styles.kioskBackdrop} role="dialog" aria-modal="true" aria-label="키오스크 주문">
      <div className={styles.kiosk}>
        <div className={styles.kioskHead}>
          <b>🍔 주문하기</b>
          <button type="button" onClick={onClose} aria-label="닫기">
            ✕
          </button>
        </div>
        {error && <p className={styles.kioskEmpty}>메뉴를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.</p>}
        {!error && !items && <p className={styles.kioskEmpty}>메뉴 불러오는 중…</p>}
        {items && (
          <ul className={styles.menu}>
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" onClick={() => onOrder(item)}>
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span className={styles.menuEmoji}>🍔</span>
                  )}
                  <small>{item.brand}</small>
                  <b>{item.name}</b>
                  <em>{item.price ? `${item.price.toLocaleString()}원` : '가격 미정'}</em>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

type RecommendItem = {
  id: number;
  name: string;
  imageUrl?: string | null;
  brand?: { name: string };
  variants?: { isDefault?: boolean; prices?: { store?: number } }[];
};

function toMenuItem(p: RecommendItem): MenuItem {
  const variant = p.variants?.find((v) => v.isDefault) ?? p.variants?.[0];
  return { id: p.id, name: p.name, brand: p.brand?.name ?? '', price: variant?.prices?.store || null, imageUrl: p.imageUrl ?? null };
}

// ─── 효과음 (파일 없이 Web Audio 로 합성) ───
let audio: AudioContext | null = null;
const ctx = () => (audio ??= new AudioContext());

function tone(freq: number, start: number, duration: number, volume = 0.2) {
  const c = ctx();
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, c.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + start + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(c.currentTime + start);
  osc.stop(c.currentTime + start + duration);
}

// 딩-동 (주문 나왔어요)
function playBell() {
  tone(1046, 0, 0.6);
  tone(784, 0.25, 0.9);
}

// 와삭 (한 입)
function playBite() {
  const c = ctx();
  const buffer = c.createBuffer(1, c.sampleRate * 0.12, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 1800;
  const gain = c.createGain();
  gain.gain.value = 0.35;
  src.connect(filter).connect(gain).connect(c.destination);
  src.start();
}

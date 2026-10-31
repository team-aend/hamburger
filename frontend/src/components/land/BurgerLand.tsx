'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Component, useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import SiteHeader from '@/components/SiteHeader';
import { LAND_PLACES, landDestination, landKeyDirection, type LandPlaceId, type LandPoint } from '@/data/burgerLand';

const LandScene = dynamic(() => import('./LandScene'), { ssr: false, loading: () => null });
export type LandLabel = { id: LandPlaceId; x: number; y: number };

class MapBoundary extends Component<{ children: ReactNode; onUnavailable: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onUnavailable(); }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function BurgerLand() {
  const [selected, setSelected] = useState<LandPlaceId | null>(null);
  const router = useRouter();
  const controls = useRef(new Map<string, LandPoint>());
  const [nearby, setNearby] = useState<LandPlaceId | null>(null);
  const [ready, setReady] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [labels, setLabels] = useState<LandLabel[]>([]);
  const [reducedMotion, setReducedMotion] = useState(true);
  const place = LAND_PLACES.find((item) => item.id === (selected ?? nearby));
  const moving = Boolean(selected && selected !== nearby && !unavailable);
  const onReady = useCallback(() => setReady(true), []);
  const onUnavailable = useCallback(() => { setUnavailable(true); setLabels([]); }, []);
  const onNearby = useCallback((id: LandPlaceId | null) => setNearby(id), []);
  const onSelect = useCallback((id: LandPlaceId) => {
    if (selected === id) return;
    controls.current.clear();
    setSelected(id);
  }, [selected]);

  useEffect(() => {
    const inputs = controls.current;
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, header, nav, [contenteditable="true"], [role="dialog"]'));
    const down = (event: KeyboardEvent) => {
      if (editable(event.target) || event.altKey || event.ctrlKey || event.metaKey) return;
      const direction = landKeyDirection(event.code, event.key);
      if (!direction || !ready || unavailable) return;
      event.preventDefault();
      if (!event.repeat) inputs.set(`tap-${event.code || event.key}`, direction);
      inputs.set(event.code || event.key, direction);
      setSelected(null);
    };
    const up = (event: KeyboardEvent) => { inputs.delete(event.code || event.key); };
    const clear = () => inputs.clear();
    const hidden = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      clear();
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [ready, unavailable]);

  useEffect(() => {
    const enter = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || event.repeat || !nearby || unavailable || (selected && selected !== nearby)) return;
      if (event.target instanceof HTMLElement && event.target.closest('button, a, input, textarea, select, header, nav, [contenteditable="true"], [role="dialog"]')) return;
      event.preventDefault();
      router.push(landDestination(LAND_PLACES.find((item) => item.id === nearby)!));
    };
    window.addEventListener('keydown', enter);
    return () => window.removeEventListener('keydown', enter);
  }, [nearby, selected, unavailable, router]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return <main className="land-shell">
    <SiteHeader activeMenu="land" />
    <div className="land-content">
      <div className="land-heading">
        <div><span className="land-eyebrow"><i /> A LITTLE WORLD, A BIG APPETITE</span><h1>어서 와요, <strong>버거 랜드!</strong></h1><p>맛있는 모험이 기다리는 작은 마을. 오늘은 어디서 놀까요?</p></div>
        <span className="land-world-badge"><span aria-hidden="true">✳</span> 4개의 장소, 무한한 취향</span>
      </div>

      <section className="land-playground" aria-label="버거 랜드 탐험">
        <div className="land-map" role="group" aria-label="3D 마을 지도. 방향키 또는 WASD로 잔디와 산책로를 자유롭게 이동하세요. 건물 입구에서 입장할 수 있습니다.">
          <div className="land-map-top"><span><i /> BURGER LAND</span><span>작은 모험의 시작</span></div>
          {unavailable ? <div className="land-map-message" role="status"><span aria-hidden="true">🍔</span><strong>아래에서 가고 싶은 장소를 골라주세요.</strong><p>지도를 표시할 수 없어도 모든 게임을 즐길 수 있어요.</p></div>
            : <MapBoundary onUnavailable={onUnavailable}><LandScene selected={selected} reducedMotion={reducedMotion} controls={controls} onNearby={onNearby} onReady={onReady} onUnavailable={onUnavailable} onLabels={setLabels} onSelect={onSelect} /></MapBoundary>}
          {!ready && !unavailable && <span className="land-map-loading" role="status">마을을 열고 있어요…</span>}
          <div className="land-map-labels">{labels.filter((label) => label.x > 0 && label.x < 100 && label.y > 0 && label.y < 100).map((label) => {
            const item = LAND_PLACES.find((candidate) => candidate.id === label.id)!;
            return <button key={label.id} type="button" aria-label={`${item.name} 선택`} aria-pressed={selected === item.id} className="land-map-label" style={{ left: `${label.x}%`, top: `${label.y}%`, '--place-color': item.color } as CSSProperties} onClick={() => onSelect(item.id)}><small>{item.number}</small>{item.name}<span aria-hidden="true">↗</span></button>;
          })}</div>
          <div className="land-map-bottom"><span aria-hidden="true">N ↗</span><p>건물을 누르면 버거 친구가 찾아가요.</p><span aria-hidden="true">✦</span></div>
        </div>

        {place && <aside className="land-place-panel" style={{ '--place-color': place.color } as CSSProperties} aria-label="선택한 장소">
          <button className="land-panel-close" type="button" aria-label="장소 안내 닫기" onClick={() => { setSelected(null); setNearby(null); }}>✕</button>
          <div className="land-panel-top"><span>YOUR NEXT STOP</span><span>{place ? `${place.number} / 04` : 'LET’S PLAY'}</span></div>
          <div className="land-place-art" aria-hidden="true"><span>{place?.icon ?? '🍔'}</span><i>BURGER<br />EXPLORER</i></div>
          <div className="land-place-copy"><small>{place?.label ?? 'PICK YOUR ADVENTURE'}</small><h2>{place?.name ?? '어디로 떠나볼까요?'}</h2><p>{place?.description ?? '마을 속 건물이나 아래 장소 카드를 골라보세요. 버거 친구와 함께 입구까지 산책해요.'}</p></div>
          <p className="land-arrival" role="status" aria-live="polite">{!place ? '가고 싶은 장소를 선택하세요.' : unavailable ? '바로 입장할 수 있어요.' : nearby !== place.id ? (ready ? `${place.name} 입구 가까이 이동해 주세요.` : '마을을 준비하고 있어요…') : `${place.name} 입구예요! 버튼 또는 Enter로 입장하세요.`}</p>
          {place && (unavailable || nearby === place.id) ? <Link className="land-enter" href={landDestination(place)}>{place.activity} 입장하기 <span aria-hidden="true">→</span></Link>
            : <button className="land-enter" type="button" disabled>{moving ? '입구로 이동 중…' : '입구 가까이 이동해 주세요'}<span aria-hidden="true">→</span></button>}
          <span className="land-panel-note">로그인 없이도 가볍게 즐겨요.</span>
        </aside>}
      </section>

      {!unavailable && <div className="land-controls" role="group" aria-label="모바일 이동 컨트롤">
        <span>자유롭게 이동</span>
        {([['up', '위로', '▲', [0, -1]], ['left', '왼쪽으로', '◀', [-1, 0]], ['down', '아래로', '▼', [0, 1]], ['right', '오른쪽으로', '▶', [1, 0]]] as const).map(([id, label, icon, direction]) =>
          <button key={id} className={`land-direction land-direction-${id}`} type="button" aria-label={`${label} 이동`} disabled={!ready}
            onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); controls.current.set(`tap-pointer-${event.pointerId}`, direction); controls.current.set(`pointer-${event.pointerId}`, direction); setSelected(null); }}
            onPointerUp={(event) => controls.current.delete(`pointer-${event.pointerId}`)}
            onPointerCancel={(event) => { controls.current.delete(`pointer-${event.pointerId}`); controls.current.delete(`tap-pointer-${event.pointerId}`); }}
            onLostPointerCapture={(event) => controls.current.delete(`pointer-${event.pointerId}`)}>{icon}</button>)}
      </div>}
      <section className="land-places" aria-label="가고 싶은 장소 선택">
        {LAND_PLACES.map((item) => <button key={item.id} type="button" className="land-place-card" aria-pressed={selected === item.id} onClick={() => onSelect(item.id)} style={{ '--place-color': item.color } as CSSProperties}>
          <span className="land-card-icon" aria-hidden="true">{item.icon}</span><span><small>{item.number} · {item.label}</small><strong>{item.name}</strong><em>{item.activity}</em></span><b aria-hidden="true">↗</b>
        </button>)}
      </section>
      <div className="land-guide"><p><b>HOW TO PLAY</b><span>방향키 · WASD / 모바일 방향 패드</span><i>→</i><span>입구에서 입장</span></p><span>느긋하게 골라도 괜찮아요.</span></div>
    </div>
  </main>;
}

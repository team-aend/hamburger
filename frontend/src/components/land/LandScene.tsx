'use client';

import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, type RefObject } from 'react';
import { Group, OrthographicCamera, Shape, Vector3 } from 'three';
import { LAND_BENCHES, LAND_TREES, LAND_PATH_LIMIT, LAND_PLACES, LAND_RADIUS, LAND_ROAD_ROWS, landWalkPath, moveOnLand, nearbyLandPlace, stepToward, type LandPlace, type LandPlaceId, type LandPoint } from '@/data/burgerLand';
import type { LandLabel } from './BurgerLand';

interface Props {
  selected: LandPlaceId | null;
  reducedMotion: boolean;
  onSelect: (id: LandPlaceId) => void;
  controls: RefObject<Map<string, LandPoint>>;
  onNearby: (id: LandPlaceId | null) => void;
  onReady: () => void;
  onUnavailable: () => void;
  onLabels: (labels: LandLabel[]) => void;
}
type Triple = [number, number, number];

function Block({ position, size, color, rotation }: { position: Triple; size: Triple; color: string; rotation?: Triple }) {
  return <mesh position={position} rotation={rotation}><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={.85} /></mesh>;
}

function Ball({ position, scale, color }: { position: Triple; scale: Triple; color: string }) {
  return <mesh position={position} scale={scale}><sphereGeometry args={[1, 16, 10]} /><meshStandardMaterial color={color} roughness={.8} /></mesh>;
}

function Cylinder({ position, radius, height, color, segments = 20 }: { position: Triple; radius: number; height: number; color: string; segments?: number }) {
  return <mesh position={position}><cylinderGeometry args={[radius, radius, height, segments]} /><meshStandardMaterial color={color} roughness={.85} flatShading /></mesh>;
}

function Door({ position }: { position: Triple }) {
  const shape = useMemo(() => {
    const arch = new Shape();
    arch.moveTo(-.42, 0); arch.lineTo(.42, 0); arch.lineTo(.42, .65);
    arch.quadraticCurveTo(.42, 1.1, 0, 1.1); arch.quadraticCurveTo(-.42, 1.1, -.42, .65); arch.closePath();
    return arch;
  }, []);
  return <group position={position}><mesh><shapeGeometry args={[shape]} /><meshStandardMaterial color="#384e42" /></mesh><Ball position={[.23, .45, .04]} scale={[.055, .055, .055]} color="#ffd076" /></group>;
}

function Burger({ scale = 1 }: { scale?: number }) {
  return <group scale={scale}>
    <Cylinder position={[0, .12, 0]} radius={1} height={.28} color="#eead55" />
    <Cylinder position={[0, .31, 0]} radius={1.04} height={.12} color="#66a54e" segments={12} />
    <Cylinder position={[0, .46, 0]} radius={.97} height={.2} color="#744535" />
    <Block position={[0, .6, 0]} size={[1.62, .07, 1.62]} color="#ffd95e" rotation={[0, .35, 0]} />
    <Cylinder position={[0, .69, 0]} radius={.98} height={.13} color="#e87154" />
    <mesh position={[0, .77, 0]} scale={[1, .62, 1]}><sphereGeometry args={[1.03, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#f4b868" roughness={.9} /></mesh>
    {[[-.4, .34], [.05, .5], [.42, .2], [-.18, -.35], [.38, -.33]].map(([x, z], index) => <Ball key={index} position={[x, 1.29 - (x * x + z * z) * .22, z]} scale={[.055, .025, .1]} color="#fff3cb" />)}
  </group>;
}

function Arena() {
  return <group>
    <Cylinder position={[0, .8, 0]} radius={1.65} height={1.6} color="#d97457" />
    <Cylinder position={[0, .15, 0]} radius={1.77} height={.3} color="#f8e0af" />
    <Cylinder position={[0, 1.55, 0]} radius={1.78} height={.2} color="#fff0c8" />
    <group position={[0, 1.65, 0]}><Burger scale={1.65} /></group>
    <Door position={[0, .15, 1.67]} />
    {[-.95, .95].map((x) => <Block key={x} position={[x, .94, 1.42]} size={[.32, .52, .12]} color="#ffe9a8" />)}
  </group>;
}

function Factory() {
  return <group>
    <Block position={[0, 1, 0]} size={[3.1, 2, 2.7]} color="#f4b19c" />
    <Block position={[0, 2.08, 0]} size={[3.4, .22, 2.95]} color="#fff0cd" />
    <Block position={[0, .12, 0]} size={[3.4, .24, 2.95]} color="#dd8066" />
    <Door position={[0, .15, 1.37]} />
    {[-1.15, 1.15].map((x) => <Block key={x} position={[x, 1.1, 1.38]} size={[.48, .65, .08]} color="#b5d8d5" />)}
    {Array.from({ length: 8 }, (_, index) => <Block key={index} position={[-1.4 + index * .4, 1.62, 1.51]} size={[.4, .15, .7]} color={index % 2 ? '#fff2d8' : '#d95f4d'} rotation={[-.18, 0, 0]} />)}
    <group position={[0, 2.18, 0]} rotation={[0, -.15, .08]}>
      {[-.6, -.4, -.2, 0, .2, .4, .6].map((x, index) => <Block key={x} position={[x, 1.02 + (index % 3) * .11, 0]} size={[.16, 1.3, .2]} color={index % 2 ? '#f4b535' : '#ffda71'} rotation={[0, 0, x * .18]} />)}
      <Block position={[0, .48, .05]} size={[1.65, 1.05, .68]} color="#da624b" />
      <Ball position={[0, .52, .41]} scale={[.3, .3, .05]} color="#ffe2a0" />
    </group>
    <Block position={[-1.1, 2.65, -.8]} size={[.5, 1.4, .5]} color="#c37b63" />
  </group>;
}

function Lab() {
  return <group>
    <Cylinder position={[0, 1, 0]} radius={1.5} height={2} color="#baa7d8" />
    <Cylinder position={[0, .12, 0]} radius={1.72} height={.24} color="#e9dcf3" />
    <Cylinder position={[0, 1.9, 0]} radius={1.68} height={.2} color="#eee4fa" />
    <mesh position={[0, 2.02, 0]}><sphereGeometry args={[1.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color="#9cbed4" metalness={.15} roughness={.45} /></mesh>
    <Door position={[0, .15, 1.52]} />
    {[-1, 1].map((x) => <Ball key={x} position={[x, 1.12, 1.15]} scale={[.24, .3, .08]} color="#fff0d0" />)}
    <group position={[.5, 3.25, 0]} rotation={[0, 0, -.65]}>
      <Cylinder position={[0, .25, 0]} radius={.27} height={1.25} color="#f7e6c5" />
      <Cylinder position={[0, .85, 0]} radius={.34} height={.14} color="#6b7f9d" />
    </group>
    <Ball position={[-.6, 3.45, .3]} scale={[.15, .15, .15]} color="#ffd070" />
  </group>;
}

function Hall() {
  return <group>
    <Block position={[0, .12, .12]} size={[3.5, .24, 3]} color="#bad0d6" />
    <Block position={[0, 1, -.1]} size={[3, 1.8, 2.4]} color="#f4dfb1" />
    <Block position={[0, 2, 0]} size={[3.5, .3, 2.9]} color="#d2af64" />
    {[-1.2, -.7, .7, 1.2].map((x) => <Cylinder key={x} position={[x, 1, 1.25]} radius={.15} height={1.65} color="#fff4d6" segments={12} />)}
    <Door position={[0, .2, 1.12]} />
    <group position={[0, 2.2, 0]}>
      <Cylinder position={[0, .13, 0]} radius={.64} height={.2} color="#b88838" />
      <Cylinder position={[0, .55, 0]} radius={.16} height={.7} color="#eab647" />
      <mesh position={[0, 1.2, 0]}><cylinderGeometry args={[.7, .23, .85, 16]} /><meshStandardMaterial color="#f4c359" metalness={.25} roughness={.4} /></mesh>
      {[-.67, .67].map((x) => <mesh key={x} position={[x, 1.25, 0]}><torusGeometry args={[.34, .085, 6, 16]} /><meshStandardMaterial color="#e4ae41" /></mesh>)}
      <Cylinder position={[0, 1.64, 0]} radius={.56} height={.025} color="#b17c2b" />
    </group>
  </group>;
}

function Landmark({ place, selected, onSelect }: { place: LandPlace; selected: boolean; onSelect: Props['onSelect'] }) {
  const { gl } = useThree();
  const choose = (event: ThreeEvent<MouseEvent>) => { event.stopPropagation(); onSelect(place.id); };
  return <group>
    <group position={[place.position[0], .38, place.position[1]]} onClick={choose}
      onPointerOver={(event) => { event.stopPropagation(); gl.domElement.style.cursor = 'pointer'; }}
      onPointerOut={() => { gl.domElement.style.cursor = 'default'; }}>
      {place.id === 'arena' ? <Arena /> : place.id === 'factory' ? <Factory /> : place.id === 'lab' ? <Lab /> : <Hall />}
    </group>
    {selected && <mesh position={[place.entrance[0], .42, place.entrance[1]]} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.52, .65, 32]} /><meshBasicMaterial color="#fff8db" /></mesh>}
  </group>;
}

function Tree({ x, z, size = 1 }: { x: number; z: number; size?: number }) {
  return <group position={[x, .35, z]} scale={size}>
    <Cylinder position={[0, .55, 0]} radius={.12} height={1.1} color="#94714e" segments={6} />
    <mesh position={[0, 1.55, 0]} scale={[.85, 1.1, .85]}><icosahedronGeometry args={[1, 0]} /><meshStandardMaterial color="#699d68" flatShading /></mesh>
    <Ball position={[.35, 1.6, .55]} scale={[.12, .12, .12]} color="#efbb64" />
  </group>;
}

function Village() {
  return <group>
    <mesh position={[0, -.05, 0]}><cylinderGeometry args={[LAND_RADIUS, LAND_RADIUS - .5, .75, 32]} /><meshStandardMaterial color="#90b778" flatShading /></mesh>
    <mesh position={[0, .33, 0]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[LAND_RADIUS - .05, 32]} /><meshStandardMaterial color="#bad393" /></mesh>
    <Block position={[0, .36, 0]} size={[2.8, .045, LAND_PATH_LIMIT * 2 + .6]} color="#eeddac" />
    {LAND_ROAD_ROWS.map((z) => <Block key={z} position={[0, .36, z]} size={[LAND_PATH_LIMIT * 2 + .6, .045, 2.8]} color="#eeddac" />)}
    <mesh position={[0, .39, 1.6]} rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[2.5, 32]} /><meshStandardMaterial color="#f4e5be" /></mesh>
    {LAND_TREES.map(({ position: [x, z], size }, index) => <Tree key={index} x={x} z={z} size={size} />)}
    {LAND_BENCHES.map(([x, z], index) => <group key={index} position={[x, .45, z]}>
      <Block position={[0, .38, 0]} size={[1.25, .12, .5]} color="#ba8058" />
      <Block position={[0, .7, -.25]} size={[1.25, .45, .1]} color="#ca9568" />
      {[-.45, .45].map((leg) => <Block key={leg} position={[leg, .15, 0]} size={[.1, .5, .4]} color="#657760" />)}
    </group>)}
    {[[-2, -4.5], [1.9, 5.9], [-5.5, -5.3], [6, -.6], [-7, 2.8], [3, 6.5]].map(([x, z], index) => <group key={index} position={[x * 1.65, .4, z * 1.65]}>
      <Ball position={[0, .15, 0]} scale={[.3, .18, .3]} color={index % 2 ? '#e4af9b' : '#f5d678'} />
      <Ball position={[.3, .1, .22]} scale={[.19, .13, .19]} color="#81a966" />
    </group>)}
    <group position={[0, .4, 13.1]}><Block position={[-1.1, .6, 0]} size={[.1, 1.2, .1]} color="#9a7452" /><Block position={[1.1, .6, 0]} size={[.1, 1.2, .1]} color="#9a7452" /><Block position={[0, 1.15, 0]} size={[2.8, .5, .15]} color="#f1c96c" /></group>
  </group>;
}

function Character({ selected, reducedMotion, controls, onNearby, playerPosition }: Pick<Props, 'selected' | 'reducedMotion' | 'controls' | 'onNearby'> & { playerPosition: Vector3 }) {
  const group = useRef<Group>(null);
  const path = useRef<LandPoint[]>([]);
  const proximity = useRef<LandPlaceId | null>(null);
  const { invalidate } = useThree();
  useEffect(() => {
    const place = LAND_PLACES.find((item) => item.id === selected);
    if (!place || !group.current) {
      path.current = [];
      return;
    }
    if (reducedMotion) {
      group.current.position.set(place.entrance[0], .5, place.entrance[1]);
      path.current = [];
    } else path.current = landWalkPath([group.current.position.x, group.current.position.z], place.entrance);
    const nearby = nearbyLandPlace([group.current.position.x, group.current.position.z]);
    proximity.current = nearby;
    onNearby(nearby);
    invalidate();
  }, [selected, reducedMotion, onNearby, invalidate]);

  useEffect(() => {
    const wake = () => invalidate();
    window.addEventListener('keydown', wake);
    window.addEventListener('pointerdown', wake);
    return () => {
      window.removeEventListener('keydown', wake);
      window.removeEventListener('pointerdown', wake);
    };
  }, [invalidate]);

  useFrame((state, delta) => {
    const player = group.current;
    if (!player) return;
    const direction: [number, number] = [0, 0];
    controls.current.forEach(([x, z]) => { direction[0] += x; direction[1] += z; });
    const manual = controls.current.size > 0;
    let tapped = false;
    controls.current.forEach((_, key) => {
      if (key.startsWith('tap-')) { tapped = true; controls.current.delete(key); }
    });
    if (manual) path.current = [];
    const target = path.current[0];
    const start: LandPoint = [player.position.x, player.position.z];
    const point = manual ? moveOnLand(start, direction, Math.max(tapped ? .12 : 0, Math.min(delta, .05) * 4))
      : target ? stepToward(start, target, Math.min(delta, .05) * 5) : start;
    const moving = Math.hypot(point[0] - start[0], point[1] - start[1]) > .0001;
    if (moving) player.rotation.y = Math.atan2(point[0] - start[0], point[1] - start[1]);
    player.position.set(point[0], .5 + (moving && !reducedMotion ? Math.abs(Math.sin(state.clock.elapsedTime * 12)) * .09 : 0), point[1]);
    if (target && !manual && Math.hypot(point[0] - target[0], point[1] - target[1]) < .01) path.current.shift();
    playerPosition.copy(player.position);
    const nearby = nearbyLandPlace(point);
    if (proximity.current !== nearby) {
      proximity.current = nearby;
      onNearby(nearby);
    }
    if (manual || path.current.length || moving) invalidate();
  });

  return <group ref={group} position={[0, .5, 1.6]}>
    <Burger scale={.52} />
    {[-.2, .2].map((x) => <Ball key={x} position={[x, .07, .22]} scale={[.14, .1, .2]} color="#624c3c" />)}
    {[-.16, .16].map((x) => <Ball key={x} position={[x, .52, .43]} scale={[.043, .06, .035]} color="#483f33" />)}
    <Ball position={[0, .4, .5]} scale={[.05, .025, .025]} color="#d36b53" />
  </group>;
}

function Viewport({ onLabels, onReady, onUnavailable, playerPosition }: Pick<Props, 'onLabels' | 'onReady' | 'onUnavailable'> & { playerPosition: Vector3 }) {
  const { camera, size, gl, invalidate } = useThree();
  const lastPosition = useRef(new Vector3(Infinity, 0, Infinity));
  const updateCamera = useCallback(() => {
    const x = playerPosition.x;
    const z = playerPosition.z - 1.6;
    camera.position.set(17 + x, 19, 23 + z);
    camera.lookAt(x, .5, .6 + z);
    camera.updateMatrixWorld();
    lastPosition.current.copy(playerPosition);
    onLabels(LAND_PLACES.map((place) => {
      const point = new Vector3(place.position[0], 4.7, place.position[1]).project(camera);
      return { id: place.id, x: (point.x + 1) * 50, y: (1 - point.y) * 50 };
    }));
  }, [camera, playerPosition, onLabels]);
  useLayoutEffect(() => {
    if (camera instanceof OrthographicCamera) {
      camera.zoom = Math.min(size.width / (size.width <= 760 ? 23 : 27), size.height / 20);
      camera.updateProjectionMatrix();
    }
    updateCamera();
    invalidate();
  }, [camera, size.width, size.height, updateCamera, invalidate]);
  useFrame(() => {
    if (!lastPosition.current.equals(playerPosition)) updateCamera();
  });
  useEffect(() => {
    const canvas = gl.domElement;
    const lost = (event: Event) => { event.preventDefault(); onUnavailable(); };
    canvas.addEventListener('webglcontextlost', lost);
    onReady();
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [gl, onReady, onUnavailable]);
  return null;
}

export default memo(function LandScene(props: Props) {
  const playerPosition = useMemo(() => new Vector3(0, .5, 1.6), []);
  return <Canvas className="land-canvas" orthographic camera={{ position: [17, 19, 23], near: .1, far: 100, zoom: 28 }} frameloop="demand" dpr={[1, 1.5]} gl={{ antialias: true, alpha: true, powerPreference: 'low-power' }}
    fallback={<span>아래 장소 카드에서 게임을 선택해 주세요.</span>} aria-label="버거 건물과 버거 친구가 있는 3D 마을">
    <ambientLight intensity={1.9} />
    <directionalLight position={[-6, 14, 8]} intensity={2.6} color="#fff1d8" />
    <directionalLight position={[8, 7, -8]} intensity={.65} color="#cbe8e8" />
    <Village />
    {LAND_PLACES.map((place) => <Landmark key={place.id} place={place} selected={props.selected === place.id} onSelect={props.onSelect} />)}
    <Character playerPosition={playerPosition} selected={props.selected} reducedMotion={props.reducedMotion} controls={props.controls} onNearby={props.onNearby} />
    <Viewport playerPosition={playerPosition} onLabels={props.onLabels} onReady={props.onReady} onUnavailable={props.onUnavailable} />
  </Canvas>;
});

'use client';

import { useEffect, useRef, useState } from 'react';
import {
  GAME_DURATION_SECONDS,
  INGREDIENT_KEYS,
  INGREDIENT_ORDER,
  INGREDIENTS,
  SCORE_PER_BURGER,
  SHOWCASE_BURGER,
} from '@/data/burgerGame';
import { useBurgerGame } from '@/hooks/useBurgerGame';
import { keyLabel, keyToAction, type GameKeyAction } from '@/lib/burgerGame';
import type { IngredientType } from '@/types/burgerGame';
import BurgerStack from './BurgerStack';
import IngredientIcon from './IngredientIcon';
import GameHeader from './GameHeader';
import IngredientPanel from './IngredientPanel';
import OrderCard from './OrderCard';
import styles from './BurgerGame.module.css';

/** 재료 외의 조작 버튼 (키보드로 눌렀을 때 눌린 모양을 보여줄 대상) */
type ControlKey = Exclude<GameKeyAction['type'], 'add'>;
const CONTROL_KEYS: ControlKey[] = ['submit', 'undo', 'reset'];

export default function BurgerGame() {
  const game = useBurgerGame();
  const panelRef = useRef<HTMLDivElement>(null);
  /** 키보드로 방금 누른 버튼 (잠깐 눌린 모양으로 보여준다) */
  const [pressed, setPressed] = useState<IngredientType | ControlKey | null>(null);
  const pressedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // 완성·초기화·되돌리기로 햄버거가 비면 방금 누른 버튼이 disabled 가 되어 키보드 포커스가 사라진다.
  // 그럴 때는 첫 번째 재료 버튼으로 포커스를 옮겨 바로 다음 재료를 고를 수 있게 한다.
  const focusIngredients = () => panelRef.current?.querySelector('button')?.focus();
  const handleSubmit = () => {
    if (game.submit()) focusIngredients();
  };
  const handleReset = () => {
    game.reset();
    focusIngredients();
  };
  const handleUndo = () => {
    if (game.stack.length === 1) focusIngredients();
    game.undo();
  };

  // PC 키보드 조작: Q~T·A~G 재료, Space/Enter 완성, Backspace 되돌리기, Esc 초기화.
  // 시작·결과 화면에서는 Space/Enter 로 게임을 시작한다.
  // 매 렌더마다 최신 상태로 다시 등록한다. (리스너 하나라 비용이 작다)
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (game.status === 'ready' || game.status === 'finished') {
        // 포커스된 버튼은 브라우저가 알아서 누르므로 두 번 시작하지 않게 건너뛴다.
        if ((event.code === 'Space' || event.code === 'Enter') && !(event.target instanceof HTMLButtonElement)) {
          event.preventDefault();
          game.start();
        }
        return;
      }
      if (game.status !== 'playing') return;
      const action = keyToAction(event.code);
      if (!action) return;
      // 포커스된 버튼이 Space/Enter 로 함께 눌리거나, Backspace 로 페이지가 뒤로 가지 않게 막는다.
      event.preventDefault();
      // 키를 꾹 누르고 있을 때 같은 재료가 연달아 쌓이지 않게 한다.
      if (event.repeat) return;

      setPressed(action.type === 'add' ? action.ingredient : action.type);
      clearTimeout(pressedTimerRef.current);
      pressedTimerRef.current = setTimeout(() => setPressed(null), 120);

      if (action.type === 'add') game.addIngredient(action.ingredient);
      else if (action.type === 'submit') handleSubmit();
      else if (action.type === 'undo') handleUndo();
      else handleReset();
    };
    // Space 는 손을 뗄 때 포커스된 버튼을 누르므로 keyup 도 막는다.
    const onKeyUp = (event: KeyboardEvent) => {
      if (game.status === 'playing' && event.code === 'Space') event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  });

  useEffect(() => () => clearTimeout(pressedTimerRef.current), []);

  if (game.status === 'ready') {
    return (
      <section className={`${styles.screen} ${styles.store}`} aria-labelledby="game-intro-title">
        <StoreAwning />
        <div className={styles.screenBody}>
          <BurgerStack ingredients={SHOWCASE_BURGER} label="햄버거 쌓기 게임" />
          <span className={styles.eyebrow}>MINI GAME</span>
          <h1 id="game-intro-title" className={styles.screenTitle}>
            햄버거 쌓기
          </h1>
          <p className={styles.screenText}>
            손님의 주문서를 보고 재료를 <b>아래빵부터 순서대로</b> 쌓아주세요.
            <br />
            {GAME_DURATION_SECONDS}초 동안 최대한 많은 햄버거를 완성하세요! (1개당 {SCORE_PER_BURGER}점)
          </p>
          <KeyboardGuide />
          <button className={styles.primaryButton} type="button" onClick={game.start}>
            게임 시작 <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>
    );
  }

  if (game.status === 'finished') {
    return (
      <section className={`${styles.screen} ${styles.store}`} aria-labelledby="game-result-title">
        <StoreAwning />
        <div className={styles.screenBody}>
          <h1 id="game-result-title" className={styles.timeOver}>
            TIME OVER!
          </h1>
          <div className={styles.resultReveal}>
            <dl className={styles.result}>
              <div>
                <dt>최종 점수</dt>
                <dd>{game.score.toLocaleString('ko-KR')}점</dd>
              </div>
              <div>
                <dt>완성한 햄버거</dt>
                <dd>{game.completedCount}개</dd>
              </div>
            </dl>
            <button className={styles.primaryButton} type="button" onClick={game.start} autoFocus>
              다시 하기 <span aria-hidden="true">↻</span>
            </button>
          </div>
        </div>
      </section>
    );
  }

  const isCountdown = game.status === 'countdown';
  const isEmpty = game.stack.length === 0;
  const pressedClass = (type: ControlKey) => (pressed === type ? styles.pressed : '');
  const pressedIngredient = pressed && !CONTROL_KEYS.includes(pressed as ControlKey) ? (pressed as IngredientType) : null;

  return (
    <div className={styles.game}>
      <GameHeader score={game.score} timeLeft={game.timeLeft} completedCount={game.completedCount} />

      <section className={styles.store} aria-label="햄버거 쌓기 게임">
        <StoreAwning />
        {/* 카운트다운 중에는 화면 뒤쪽을 조작할 수 없게 막는다. */}
        <div className={styles.board} inert={isCountdown}>
          <div className={styles.order}>
            {game.currentOrder && (
              <OrderCard
                key={game.completedCount}
                order={game.currentOrder}
                orderNumber={game.completedCount + 1}
              />
            )}
          </div>

          <div className={styles.kitchen}>
            <BurgerStack
              ingredients={game.stack}
              animate
              label="내가 만든 햄버거"
              emptyText="재료를 눌러 아래빵부터 쌓아보세요"
            />
            <p className={styles.feedbackArea} aria-live="polite">
              {game.feedback && (
                <span key={game.feedback.id} className={`${styles.feedback} ${styles[game.feedback.type]}`}>
                  {game.feedback.message}
                </span>
              )}
            </p>
          </div>

          <div className={styles.panel} ref={panelRef}>
            <IngredientPanel
              onSelect={game.addIngredient}
              pressed={pressedIngredient}
            />
            <div className={styles.controls}>
              <button
                className={`${styles.secondaryButton} ${pressedClass('undo')}`}
                type="button"
                onClick={handleUndo}
                disabled={isEmpty}
                aria-keyshortcuts="Backspace"
              >
                되돌리기 <kbd className={styles.key} aria-hidden="true">⌫</kbd>
              </button>
              <button
                className={`${styles.secondaryButton} ${pressedClass('reset')}`}
                type="button"
                onClick={handleReset}
                disabled={isEmpty}
                aria-keyshortcuts="Escape"
              >
                초기화 <kbd className={styles.key} aria-hidden="true">Esc</kbd>
              </button>
              <button
                className={`${styles.submitButton} ${pressedClass('submit')}`}
                type="button"
                onClick={handleSubmit}
                disabled={isEmpty}
                aria-keyshortcuts="Space Enter"
              >
                완성 <kbd className={styles.key} aria-hidden="true">Space</kbd>
              </button>
            </div>
          </div>
        </div>

        {isCountdown && (
          <div className={styles.countdown} aria-live="assertive">
            <span key={game.countdown} className={game.countdown > 0 ? styles.countNumber : styles.countStart}>
              {game.countdown > 0 ? game.countdown : 'START!'}
            </span>
          </div>
        )}
      </section>
    </div>
  );
}

/** 시작 화면의 키보드 안내: 실제 자판처럼 키캡 두 줄(재료) + 조작 키 (PC 에서만 보인다) */
function KeyboardGuide() {
  const rows = [INGREDIENT_ORDER.slice(0, 5), INGREDIENT_ORDER.slice(5)];
  return (
    <div className={styles.keyGuide} aria-hidden="true">
      <p className={styles.keyGuideTitle}>⌨️ PC는 키보드로 플레이</p>
      {rows.map((row, index) => (
        <div key={index} className={`${styles.keyRow} ${index === 1 ? styles.keyRowShift : ''}`}>
          {row.map((type) => (
            <span key={type} className={styles.keycap} title={INGREDIENTS[type].name}>
              <b>{keyLabel(INGREDIENT_KEYS[type])}</b>
              <IngredientIcon type={type} className={styles.keycapIcon} />
            </span>
          ))}
        </div>
      ))}
      <div className={styles.actionRow}>
        <span><kbd className={styles.wideKey}>Space</kbd>완성</span>
        <span><kbd>⌫</kbd>되돌리기</span>
        <span><kbd>Esc</kbd>초기화</span>
      </div>
    </div>
  );
}

/** 가게 차양 + 간판 */
function StoreAwning() {
  return (
    <div className={styles.awning} aria-hidden="true">
      <span className={styles.sign}>BURGER PICK KITCHEN</span>
    </div>
  );
}

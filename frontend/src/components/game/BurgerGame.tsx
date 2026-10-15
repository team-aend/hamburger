'use client';

import { useRef } from 'react';
import { GAME_DURATION_SECONDS, SCORE_PER_BURGER, SHOWCASE_BURGER } from '@/data/burgerGame';
import { useBurgerGame } from '@/hooks/useBurgerGame';
import BurgerStack from './BurgerStack';
import GameHeader from './GameHeader';
import IngredientPanel from './IngredientPanel';
import OrderCard from './OrderCard';
import styles from './BurgerGame.module.css';

export default function BurgerGame() {
  const game = useBurgerGame();
  const panelRef = useRef<HTMLDivElement>(null);

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
            <IngredientPanel onSelect={game.addIngredient} />
            <div className={styles.controls}>
              <button className={styles.secondaryButton} type="button" onClick={handleUndo} disabled={isEmpty}>
                되돌리기
              </button>
              <button className={styles.secondaryButton} type="button" onClick={handleReset} disabled={isEmpty}>
                초기화
              </button>
              <button className={styles.submitButton} type="button" onClick={handleSubmit} disabled={isEmpty}>
                완성
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

/** 가게 차양 + 간판 */
function StoreAwning() {
  return (
    <div className={styles.awning} aria-hidden="true">
      <span className={styles.sign}>BURGER PICK KITCHEN</span>
    </div>
  );
}

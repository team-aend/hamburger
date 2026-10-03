'use client';

import { useEffect, useRef, useState } from 'react';
import {
  BURGER_RECIPES,
  COUNTDOWN_FROM,
  COUNTDOWN_STEP_MS,
  GAME_DURATION_SECONDS,
  SCORE_PER_BURGER,
} from '@/data/burgerGame';
import { isOrderMatched, pickNextOrder } from '@/lib/burgerGame';
import type { BurgerRecipe, GameFeedback, GameStatus, IngredientType } from '@/types/burgerGame';

const TICK_MS = 200;
const FEEDBACK_MS = 1400;

/**
 * 햄버거 쌓기 게임의 상태와 규칙.
 * UI 컴포넌트는 이 훅이 돌려주는 값과 함수만 사용한다.
 */
export function useBurgerGame() {
  const [status, setStatus] = useState<GameStatus>('ready');
  // 서버 렌더링과 랜덤 결과가 달라지지 않도록 주문은 게임 시작 시점에 뽑는다.
  const [currentOrder, setCurrentOrder] = useState<BurgerRecipe | null>(null);
  const [stack, setStack] = useState<IngredientType[]>([]);
  const [score, setScore] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [timeLeft, setTimeLeft] = useState(GAME_DURATION_SECONDS);
  const [feedback, setFeedback] = useState<GameFeedback | null>(null);
  /** 3 → 2 → 1 → 0(START!) */
  const [countdown, setCountdown] = useState(COUNTDOWN_FROM);
  // 종료 시각을 기준으로 남은 시간을 계산하면 interval 이 밀리거나 다시 실행돼도 시간이 어긋나지 않는다.
  const endAtRef = useRef(0);
  const feedbackIdRef = useRef(0);

  useEffect(() => {
    if (status !== 'countdown') return;
    let value = COUNTDOWN_FROM;
    setCountdown(value);
    const interval = setInterval(() => {
      value -= 1;
      if (value >= 0) {
        setCountdown(value);
        return;
      }
      clearInterval(interval);
      // 카운트다운이 끝난 순간부터 60초를 센다.
      endAtRef.current = Date.now() + GAME_DURATION_SECONDS * 1000;
      setStatus('playing');
    }, COUNTDOWN_STEP_MS);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (status !== 'playing') return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0) {
        setStatus('finished');
        setFeedback(null);
      }
    };
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [status]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timeout);
  }, [feedback]);

  const showFeedback = (type: GameFeedback['type'], message: string) => {
    feedbackIdRef.current += 1;
    setFeedback({ type, message, id: feedbackIdRef.current });
  };

  /**
   * 타이머 tick(200ms)이 status 를 finished 로 바꾸기 전이라도 종료 시각이 지났으면 입력을 받지 않는다.
   * (탭이 백그라운드라 tick 이 늦어져도 00:00 이후의 정답이 점수에 들어가지 않게)
   */
  const isAcceptingInput = () => status === 'playing' && Date.now() < endAtRef.current;

  const start = () => {
    // 다시 하기의 첫 주문도 직전 게임의 마지막 주문과 겹치지 않게 한다.
    setCurrentOrder(pickNextOrder(BURGER_RECIPES, currentOrder?.id ?? null));
    setStack([]);
    setScore(0);
    setCompletedCount(0);
    setTimeLeft(GAME_DURATION_SECONDS);
    setFeedback(null);
    // 직전 게임의 마지막 값(0 = START!)이 첫 화면에 잠깐 보이지 않도록 미리 되돌린다.
    setCountdown(COUNTDOWN_FROM);
    setStatus('countdown');
  };

  const addIngredient = (ingredient: IngredientType) => {
    if (!isAcceptingInput()) return;
    setStack((current) => [...current, ingredient]);
  };

  const undo = () => setStack((current) => current.slice(0, -1));

  const reset = () => setStack([]);

  /** 정답이면 true 를 돌려준다. */
  const submit = (): boolean => {
    if (!isAcceptingInput() || !currentOrder || stack.length === 0) return false;
    if (isOrderMatched(stack, currentOrder.ingredients)) {
      setScore((current) => current + SCORE_PER_BURGER);
      setCompletedCount((current) => current + 1);
      setStack([]);
      setCurrentOrder(pickNextOrder(BURGER_RECIPES, currentOrder.id));
      showFeedback('success', `${currentOrder.name} 완성! +${SCORE_PER_BURGER}점`);
      return true;
    }
    showFeedback('error', '주문과 재료 순서를 다시 확인해주세요.');
    return false;
  };

  return {
    status,
    currentOrder,
    stack,
    score,
    completedCount,
    timeLeft,
    feedback,
    countdown,
    start,
    addIngredient,
    undo,
    reset,
    submit,
  };
}

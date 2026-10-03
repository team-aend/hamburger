import { URGENT_SECONDS } from '@/data/burgerGame';
import { formatTimer } from '@/lib/burgerGame';
import styles from './GameHeader.module.css';

interface GameHeaderProps {
  score: number;
  timeLeft: number;
  completedCount: number;
}

export default function GameHeader({ score, timeLeft, completedCount }: GameHeaderProps) {
  const urgent = timeLeft <= URGENT_SECONDS;

  return (
    <>
      <dl className={styles.header}>
        <div className={styles.stat}>
          <dt>SCORE</dt>
          <dd>{score.toLocaleString('ko-KR')}</dd>
        </div>
        <div className={`${styles.stat} ${styles.timer} ${urgent ? styles.urgent : ''}`}>
          <dt>남은 시간</dt>
          <dd>
            <time>{formatTimer(timeLeft)}</time>
          </dd>
        </div>
        <div className={styles.stat}>
          <dt>완성</dt>
          <dd>{completedCount}개</dd>
        </div>
      </dl>
      {/* 매초 읽으면 정답/오답 안내가 묻히므로 긴박 구간에 들어설 때 한 번만 알린다. */}
      <span className={styles.srOnly} aria-live="polite">
        {urgent ? `${URGENT_SECONDS}초 남았어요` : ''}
      </span>
    </>
  );
}

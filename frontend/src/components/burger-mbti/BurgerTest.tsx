'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AXIS_EMOJIS, AXIS_LABELS, QUESTIONS, RESULTS } from '@/data/burgerTest';
import { AXIS_ORDER, axisPercents, calculateResult, describeCode, parseResultCode } from '@/lib/burgerTest';
import { formatCalories, formatPrice } from '@/lib/format';
import { fetchProducts } from '@/lib/products';
import type { ResultCode, TestLetter, TestResult } from '@/types/burgerTest';
import type { Product } from '@/types/product';
import styles from './BurgerTest.module.css';

type Status = 'intro' | 'quiz' | 'result';

export default function BurgerTest() {
  const [status, setStatus] = useState<Status>('intro');
  const [answers, setAnswers] = useState<TestLetter[]>([]);
  const [resultCode, setResultCode] = useState<ResultCode | null>(null);
  /** 공유 링크로 들어와 결과만 보는 중이면 true (답변이 없어 성향 막대를 숨긴다) */
  const [fromShare, setFromShare] = useState(false);

  // 공유 링크(/burger-mbti?result=HAK)로 들어오면 바로 결과를 보여준다.
  useEffect(() => {
    const shared = parseResultCode(new URLSearchParams(window.location.search).get('result'));
    if (!shared) return;
    setResultCode(shared);
    setFromShare(true);
    setStatus('result');
  }, []);

  const start = () => {
    setAnswers([]);
    setResultCode(null);
    setFromShare(false);
    setStatus('quiz');
    window.history.replaceState(null, '', '/burger-mbti');
  };

  const answer = (letter: TestLetter) => {
    const next = [...answers, letter];
    if (next.length < QUESTIONS.length) {
      setAnswers(next);
      return;
    }
    const code = calculateResult(QUESTIONS, next);
    setAnswers(next);
    setResultCode(code);
    setStatus('result');
    window.history.replaceState(null, '', `/burger-mbti?result=${code}`);
  };

  const back = () => setAnswers((prev) => prev.slice(0, -1));

  if (status === 'quiz') {
    const question = QUESTIONS[answers.length];
    const step = answers.length + 1;
    return (
      <section className={styles.card} aria-labelledby="test-question">
        <div className={styles.progressRow}>
          <span className={styles.step}>Q{step}<small> / {QUESTIONS.length}</small></span>
          {answers.length > 0 && (
            <button type="button" className={styles.backButton} onClick={back}>
              ← 이전 질문
            </button>
          )}
        </div>
        <div className={styles.progressTrack} aria-hidden="true">
          <span style={{ width: `${(answers.length / QUESTIONS.length) * 100}%` }} />
        </div>
        <h1 id="test-question" className={styles.question}>{question.text}</h1>
        <div className={styles.choices}>
          {question.choices.map((choice, index) => (
            <button
              // 질문마다 새 버튼을 만들어, 앞 질문에서 누른 버튼의 포커스·눌림 상태가 넘어오지 않게 한다.
              key={`${question.id}-${choice.letter}`}
              type="button"
              className={styles.choice}
              onClick={() => answer(choice.letter)}
            >
              <b aria-hidden="true">{index === 0 ? 'A' : 'B'}</b>
              <span>{choice.label}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (status === 'result' && resultCode) {
    return (
      <ResultView
        code={resultCode}
        percents={fromShare ? null : axisPercents(QUESTIONS, answers)}
        fromShare={fromShare}
        onRestart={start}
      />
    );
  }

  return (
    <section className={`${styles.card} ${styles.intro}`} aria-labelledby="test-intro-title">
      <span className={styles.eyebrow}>BURGER PERSONALITY TEST</span>
      <h1 id="test-intro-title" className={styles.title}>
        나와 닮은 버거는
        <br />
        <strong>무엇일까?</strong>
      </h1>
      <p className={styles.text}>
        {QUESTIONS.length}개의 질문에 답하면 든든·산뜻, 모험·클래식, 바삭·육즙
        <br />
        세 가지 성향으로 나와 꼭 닮은 버거를 찾아 드려요.
      </p>
      <button type="button" className={styles.primaryButton} onClick={start}>
        테스트 시작하기 <span aria-hidden="true">→</span>
      </button>
    </section>
  );
}

function ResultView({
  code,
  percents,
  fromShare,
  onRestart,
}: {
  code: ResultCode;
  percents: ReturnType<typeof axisPercents> | null;
  fromShare: boolean;
  onRestart: () => void;
}) {
  const result = RESULTS[code];
  const match = RESULTS[result.bestMatch];
  const burger = useBurger(result.burgerSlug);
  const [shareStatus, setShareStatus] = useState<'idle' | 'sharing' | 'copied' | 'failed'>('idle');
  const imagePath = `/burger-mbti/image/${code}`;

  useEffect(() => {
    if (shareStatus === 'idle' || shareStatus === 'sharing') return;
    // 복사 실패 안내에는 직접 복사할 링크가 있으니 오래 보여준다.
    const timer = setTimeout(() => setShareStatus('idle'), shareStatus === 'failed' ? 10000 : 2500);
    return () => clearTimeout(timer);
  }, [shareStatus]);

  /**
   * 1) 휴대폰처럼 파일 공유가 되면 결과 이미지 + 링크를 함께 공유
   * 2) 링크 공유만 되면 링크만 공유
   * 3) 공유 창이 없으면 링크 복사 (이미지는 '이미지 저장'으로 받는다)
   * 공유·복사는 https 또는 localhost 에서만 동작한다. (http://192.168... 로 접속하면 3번 실패 안내가 나온다)
   */
  const share = async () => {
    const url = `${window.location.origin}/burger-mbti?result=${code}`;
    const text = `나와 닮은 버거는 ${result.burgerName}! (${result.title}) 너는 어떤 버거야?`;
    const title = 'BURGER PICK 버거 심리테스트';
    setShareStatus('sharing');
    try {
      if (typeof navigator.share === 'function') {
        const file = await loadResultImage(imagePath, code);
        const data: ShareData = file && navigator.canShare?.({ files: [file] })
          ? { title, text: `${text}\n${url}`, files: [file] }
          : { title, text, url };
        await navigator.share(data);
        setShareStatus('idle');
        return;
      }
    } catch (error) {
      // 사용자가 공유 창을 닫은 경우는 실패로 보지 않는다.
      if (error instanceof DOMException && error.name === 'AbortError') {
        setShareStatus('idle');
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareStatus('copied');
    } catch {
      setShareStatus('failed');
    }
  };

  return (
    <section className={`${styles.card} ${styles.result}`} aria-labelledby="test-result-title">
      <span className={styles.eyebrow}>{fromShare ? '친구의 결과' : '나의 결과'} · {code}</span>
      <p className={styles.codeGuide} aria-label={`${code}: ${describeCode(code).map((part) => part.label).join(', ')}`}>
        {describeCode(code).map((part) => (
          <span key={part.letter}><b>{part.letter}</b>{part.label}</span>
        ))}
      </p>
      <p className={styles.burgerName}>{result.burgerName}</p>
      <h1 id="test-result-title" className={styles.title}>{result.title}</h1>
      <p className={styles.text}>{result.summary}</p>

      <ul className={styles.traits}>
        {result.traits.map((trait) => <li key={trait}>#{trait}</li>)}
      </ul>

      {percents && (
        <div className={styles.axes}>
          <p className={styles.axesTitle}>나의 버거 성향</p>
          {AXIS_ORDER.map((axis) => {
            const [left, right] = AXIS_LABELS[axis];
            const [leftEmoji, rightEmoji] = AXIS_EMOJIS[axis];
            const leftPercent = percents[axis];
            const rightPercent = 100 - leftPercent;
            const leftWins = leftPercent >= rightPercent;
            return (
              <div
                key={axis}
                className={styles.axis}
                role="img"
                aria-label={`${left} ${leftPercent}%, ${right} ${rightPercent}%`}
              >
                <span className={`${styles.axisSide} ${leftWins ? styles.axisWin : ''}`}>
                  <i aria-hidden="true">{leftEmoji}</i>
                  <b>{left}</b>
                  <small>{leftPercent}%</small>
                </span>
                <span className={styles.axisTrack} aria-hidden="true">
                  <span className={styles.axisLeft} style={{ width: `${leftPercent}%` }} />
                  {/* 양 끝에 붙으면 잘려 보이니 8~92% 사이에 둔다 */}
                  <span className={styles.axisMarker} style={{ left: `${Math.min(92, Math.max(8, leftPercent))}%` }}>
                    🍔
                  </span>
                </span>
                <span className={`${styles.axisSide} ${styles.axisRight} ${leftWins ? '' : styles.axisWin}`}>
                  <small>{rightPercent}%</small>
                  <b>{right}</b>
                  <i aria-hidden="true">{rightEmoji}</i>
                </span>
              </div>
            );
          })}
        </div>
      )}

      <div className={styles.report}>
        <section className={styles.section}>
          <h2><span aria-hidden="true">📝</span> 이런 사람이에요</h2>
          <ul className={styles.bullets}>
            {result.personality.map((line) => <li key={line}>{line}</li>)}
          </ul>
        </section>

        <div className={styles.twoColumns}>
          <section className={`${styles.section} ${styles.good}`}>
            <h2><span aria-hidden="true">💪</span> 이런 점이 멋져요</h2>
            <ul className={styles.bullets}>
              {result.strengths.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
          <section className={`${styles.section} ${styles.careful}`}>
            <h2><span aria-hidden="true">⚠️</span> 이럴 땐 조심해요</h2>
            <ul className={styles.bullets}>
              {result.cautions.map((line) => <li key={line}>{line}</li>)}
            </ul>
          </section>
        </div>

        <section className={styles.section}>
          <h2><span aria-hidden="true">💌</span> 연애 · 친구 스타일</h2>
          <p>{result.relationship}</p>
        </section>

        <section className={`${styles.section} ${styles.burgerSection}`}>
          <h2><span aria-hidden="true">🍔</span> 왜 {result.burgerName}{hasBatchim(result.burgerName) ? '이냐면요' : '냐면요'}</h2>
          <p>{result.burgerReason}</p>
          <div className={styles.burgerCard}>
            <div>
              <small>{burger?.brand.name ?? 'BURGER PICK 추천'}</small>
              <strong>{result.burgerName}</strong>
              {burger && (
                <span>단품 {formatPrice(burger.singlePrice)} · {formatCalories(burger.calories)}</span>
              )}
            </div>
            <Link href={burger ? `/products/${burger.id}` : '/compare'}>
              {burger ? '메뉴 자세히 보기' : '햄버거 비교 보러 가기'} →
            </Link>
          </div>
        </section>

        <div className={styles.twoColumns}>
          <MatchCard label="💞 찰떡궁합" result={match} tone="best" />
          <MatchCard label="💥 이 유형과는 티격태격" result={RESULTS[result.worstMatch]} tone="worst" />
        </div>
      </div>

      <div className={styles.actions}>
        {!fromShare && (
          <button
            type="button"
            className={styles.primaryButton}
            disabled={shareStatus === 'sharing'}
            onClick={() => void share()}
          >
            {shareStatus === 'sharing' ? '이미지 준비 중…' : '결과 공유하기'} <span aria-hidden="true">↗</span>
          </button>
        )}
        <button
          type="button"
          className={fromShare ? styles.primaryButton : styles.secondaryButton}
          onClick={onRestart}
        >
          {fromShare ? '나도 테스트하기' : '다시 하기'} <span aria-hidden="true">↻</span>
        </button>
      </div>
      {!fromShare && (
        <a className={styles.saveImage} href={imagePath} download={`burger-mbti-${code}.png`}>
          결과 이미지 저장
        </a>
      )}
      <span className={styles.shareStatus} role="status">
        {shareStatus === 'copied' && '링크를 복사했어요. 친구에게 보내보세요!'}
        {shareStatus === 'failed' && '링크를 복사하지 못했어요. 아래 주소를 직접 복사해 주세요.'}
      </span>
      {shareStatus === 'failed' && (
        <input
          className={styles.shareUrl}
          readOnly
          value={`${window.location.origin}/burger-mbti?result=${code}`}
          aria-label="공유 링크"
          onFocus={(event) => event.currentTarget.select()}
        />
      )}
    </section>
  );
}

/** 마지막 글자에 받침이 있으면 true (빅맥 → "빅맥이냐면요", 와퍼 → "와퍼냐면요") */
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  return code >= 0 && code <= 11171 && code % 28 !== 0;
}

function MatchCard({ label, result, tone }: { label: string; result: TestResult; tone: 'best' | 'worst' }) {
  return (
    <section className={`${styles.matchCard} ${tone === 'best' ? styles.matchBest : styles.matchWorst}`}>
      <h2>{label}</h2>
      <strong>{result.burgerName}</strong>
      <span>{result.title}</span>
      <small>{result.code} · {describeCode(result.code).map((part) => part.label).join(' · ')}</small>
    </section>
  );
}

/** 공유할 결과 이미지를 파일로 받는다. 실패하면 null (링크만 공유) */
async function loadResultImage(path: string, code: ResultCode): Promise<File | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return new File([await res.blob()], `burger-mbti-${code}.png`, { type: 'image/png' });
  } catch {
    return null;
  }
}

/** 결과 버거의 실제 가격·상세 링크를 DB에서 찾는다. 실패하면 null (이름만 보여준다) */
function useBurger(slug: string): Product | null {
  const [burger, setBurger] = useState<Product | null>(null);

  useEffect(() => {
    let ignore = false;
    setBurger(null);
    fetchProducts('').then((products) => {
      if (!ignore) setBurger(products?.find((product) => product.slug === slug) ?? null);
    });
    return () => {
      ignore = true;
    };
  }, [slug]);

  return burger;
}

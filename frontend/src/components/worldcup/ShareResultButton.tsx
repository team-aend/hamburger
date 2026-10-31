'use client';

import { useEffect, useState } from 'react';

/**
 * 월드컵 결과 공유. 휴대폰처럼 공유 창이 있으면 공유 창을, 없으면 링크를 복사한다.
 * 공유 링크(/share/worldcup/:id)는 누구나 볼 수 있고 우승 버거만 보여준다.
 */
export default function ShareResultButton({ sessionId, winnerName }: { sessionId: string; winnerName: string }) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');

  useEffect(() => {
    if (status === 'idle') return;
    const timer = setTimeout(() => setStatus('idle'), 2500);
    return () => clearTimeout(timer);
  }, [status]);

  const share = async () => {
    const url = `${window.location.origin}/share/worldcup/${sessionId}`;
    const text = `나의 최애 버거는 ${winnerName}! 너의 최애 버거는?`;
    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: 'BURGER PICK 햄버거 월드컵', text, url });
        return;
      } catch (error) {
        // 사용자가 공유 창을 닫은 경우는 실패로 보지 않는다.
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
    } catch {
      setStatus('failed');
    }
  };

  return (
    <div className="share-result">
      <button type="button" className="share-result-button" onClick={() => void share()}>
        <span aria-hidden="true">↗</span> 결과 공유하기
      </button>
      <span className="share-result-status" role="status">
        {status === 'copied' && '링크를 복사했어요. 친구에게 보내보세요!'}
        {status === 'failed' && '링크를 복사하지 못했어요. 주소창의 공유 기능을 이용해 주세요.'}
      </span>
    </div>
  );
}

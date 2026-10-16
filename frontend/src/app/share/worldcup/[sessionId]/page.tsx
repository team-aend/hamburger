import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import SiteHeader from '@/components/SiteHeader';
import { fetchWorldcupShare, roundLabel } from '@/lib/worldcupShare';
import '../share.css';

type Params = { params: Promise<{ sessionId: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const share = await fetchWorldcupShare((await params).sessionId).catch(() => null);
  if (!share) return { title: '월드컵 결과를 찾을 수 없어요 | Burger Pick' };
  const title = `나의 최애 버거는 ${share.winner.name}!`;
  const description = `${share.roundSize}강 햄버거 월드컵에서 ${share.winner.brandName} ${share.winner.name}가 우승했어요. 너의 최애 버거는?`;
  // 미리보기 이미지는 같은 폴더의 opengraph-image.tsx 가 자동으로 연결된다.
  return { title: `${title} | Burger Pick`, description, openGraph: { title, description, type: 'website' } };
}

/** 공유받은 사람이 보는 월드컵 결과 (로그인 없이 볼 수 있음) */
export default async function WorldcupSharePage({ params }: Params) {
  const share = await fetchWorldcupShare((await params).sessionId);
  if (!share) notFound();
  const { winner } = share;

  return (
    <main className="worldcup-shell share-shell">
      <SiteHeader activeMenu="worldcup" />
      <section className="share-content" aria-labelledby="share-title">
        <div className="share-winner">
          <span className="winner-label">{share.roundSize}강 TOURNAMENT WINNER</span>
          <h1 id="share-title">
            친구의<br /><strong>최애 버거</strong>는
          </h1>
          <div className="share-card">
            <span className="share-crown" aria-hidden="true">♛</span>
            <span className="share-burger" aria-hidden="true">🍔</span>
            <small>{winner.brandName}</small>
            <h2>{winner.name}</h2>
            {winner.description && <p>{winner.description}</p>}
            <Link className="share-detail-link" href={`/products/${winner.productId}`}>
              이 버거 자세히 보기 →
            </Link>
          </div>
        </div>

        <div className="share-side">
          {share.path.length > 0 && (
            <section aria-labelledby="share-path-title">
              <h2 id="share-path-title" className="share-section-title">우승까지 이긴 버거</h2>
              <ol className="share-path">
                {share.path.map((step) => (
                  <li key={step.roundSize}>
                    <span className="share-round">{roundLabel(step.roundSize)}</span>
                    <span className="share-opponent">
                      <small>{step.opponent.brandName}</small>
                      {step.opponent.name}
                    </span>
                    <span className="share-win">WIN</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <div className="share-cta">
            <h2>너의 최애 버거는?</h2>
            <p>두 버거 중 더 끌리는 하나만 고르면 돼요.</p>
            <Link className="start-button" href="/">
              나도 월드컵 하기 <span aria-hidden="true">→</span>
            </Link>
            <Link className="ranking-link-button" href="/ranking">
              전체 랭킹 보기 <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </section>
      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>취향에는 정답이 없습니다.</span>
      </footer>
    </main>
  );
}

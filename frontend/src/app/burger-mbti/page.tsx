import type { Metadata } from 'next';
import BurgerTest from '@/components/burger-mbti/BurgerTest';
import SiteHeader from '@/components/SiteHeader';
import { RESULTS } from '@/data/burgerTest';
import { parseResultCode } from '@/lib/burgerTest';
import './burger-mbti.css';

type Props = { searchParams: Promise<{ result?: string | string[] }> };

/** 공유 링크(?result=HAK)면 메신저 미리보기에 그 결과 이미지와 문구가 보이게 한다. */
export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const value = (await searchParams).result;
  const code = parseResultCode(typeof value === 'string' ? value : null);
  if (!code) {
    return {
      title: '버거 심리테스트 | Burger Pick',
      description: '9개의 질문으로 알아보는 나와 닮은 햄버거. 결과를 친구에게 공유해 보세요.',
    };
  }
  const result = RESULTS[code];
  const title = `나와 닮은 버거는 ${result.burgerName}!`;
  const description = `${result.title} (${code}) · 너는 어떤 버거야? 9개의 질문으로 알아보세요.`;
  return {
    title: `${title} | Burger Pick`,
    description,
    openGraph: { title, description, type: 'website', images: [{ url: `/burger-mbti/image/${code}`, width: 1200, height: 630 }] },
  };
}

export default function BurgerTestPage() {
  return (
    <main className="worldcup-shell burger-mbti-shell">
      <SiteHeader activeMenu="test" />
      <div className="burger-mbti-content">
        <BurgerTest />
      </div>
      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>취향에는 정답이 없습니다.</span>
      </footer>
    </main>
  );
}

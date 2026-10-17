import { ImageResponse } from 'next/og';
import { RESULTS } from '@/data/burgerTest';
import { describeCode, parseResultCode } from '@/lib/burgerTest';
import { loadOgFont } from '@/lib/ogFont';

/**
 * 심리테스트 결과 이미지 (1200x630).
 * 결과 공유 시 링크와 함께 보내는 이미지이자, 공유 링크의 미리보기 이미지(og:image)로 쓴다.
 *   GET /burger-mbti/image/HAK
 */
export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = parseResultCode((await params).code);
  if (!code) return new Response('Not Found', { status: 404 });

  const result = RESULTS[code];
  const headline = '나와 닮은 버거는';
  const footer = '너는 어떤 버거야? BURGER PICK 버거 심리테스트';
  const guide = describeCode(code).map((part) => part.label).join(' · ');
  const font = await loadOgFont(`${code}${guide}${headline}${result.burgerName}${result.title}#${result.traits.join('')}${footer}🍔`);

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 56, padding: '0 80px',
        background: '#f7f0df', color: '#1b1916', fontFamily: font ? 'Black Han Sans' : 'sans-serif',
      }}>
        <div style={{
          width: 340, height: 340, flexShrink: 0, borderRadius: 999, background: '#f5b82e', border: '6px solid #1b1916',
          boxShadow: '14px 14px 0 #1b1916', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center',
        }}>
          <div style={{ display: 'flex', fontSize: 116 }}>🍔</div>
          <div style={{ display: 'flex', marginTop: 6, fontSize: 50, letterSpacing: 6 }}>{code}</div>
          <div style={{ display: 'flex', marginTop: 2, fontSize: 21, color: '#4a443c' }}>{guide}</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          <div style={{ display: 'flex', fontSize: 40 }}>{headline}</div>
          <div style={{
            display: 'flex', marginTop: 8, fontSize: result.burgerName.length > 9 ? 70 : 92, color: '#e8432f', lineHeight: 1.1,
          }}>
            {result.burgerName}
          </div>
          <div style={{
            display: 'flex', alignSelf: 'flex-start', marginTop: 20, padding: '8px 22px', borderRadius: 999,
            border: '3px solid #1b1916', background: '#fffaf0', fontSize: 34,
          }}>
            {result.title}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', marginTop: 14, fontSize: 26, color: '#655e55' }}>
            {result.traits.map((trait) => (
              <div key={trait} style={{ display: 'flex', whiteSpace: 'nowrap', margin: '8px 20px 0 0' }}>#{trait}</div>
            ))}
          </div>
          <div style={{ display: 'flex', marginTop: 34, fontSize: 26, color: '#bd2c1d' }}>{footer}</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      ...(font ? { fonts: [{ name: 'Black Han Sans', data: font, style: 'normal' as const, weight: 400 as const }] } : {}),
    },
  );
}

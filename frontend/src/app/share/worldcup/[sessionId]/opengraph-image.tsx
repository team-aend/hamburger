import { ImageResponse } from 'next/og';
import { fetchWorldcupShare } from '@/lib/worldcupShare';

/** 카카오톡·메신저 등에 링크를 보냈을 때 보이는 미리보기 이미지 (1200x630) */
export const alt = 'BURGER PICK 햄버거 월드컵 결과';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * 이미지 안의 한글을 그리려면 글꼴이 필요하다. 쓰는 글자만 담은 Black Han Sans 를 Google Fonts 에서 받는다.
 * 받지 못하면(네트워크 차단 등) 기본 글꼴로 그린다.
 */
async function loadFont(text: string): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(
      `https://fonts.googleapis.com/css2?family=Black+Han+Sans&text=${encodeURIComponent(text)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } },
    )).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

export default async function Image({ params }: { params: Promise<{ sessionId: string }> }) {
  const share = await fetchWorldcupShare((await params).sessionId).catch(() => null);
  const brand = share?.winner.brandName ?? 'BURGER PICK';
  const name = share?.winner.name ?? '햄버거 월드컵';
  const headline = share ? '나의 최애 버거는' : '오늘의 최애 버거를 골라보세요';
  const round = share ? `${share.roundSize}강 우승` : '';
  const footer = '너의 최애 버거는? BURGER PICK';
  const font = await loadFont(`${headline}${brand}${name}${round}${footer}🍔`);

  return new ImageResponse(
    (
      <div style={{
        width: '100%', height: '100%', display: 'flex', alignItems: 'center', gap: 56, padding: '0 80px',
        background: '#f7f0df', color: '#1b1916', fontFamily: font ? 'Black Han Sans' : 'sans-serif',
      }}>
        <div style={{
          width: 360, height: 360, borderRadius: 999, background: '#f5b82e', border: '6px solid #1b1916',
          boxShadow: '14px 14px 0 #1b1916', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 190,
        }}>
          🍔
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
          {round && (
            <div style={{
              display: 'flex', alignSelf: 'flex-start', padding: '8px 22px', borderRadius: 999,
              border: '3px solid #1b1916', background: '#f5b82e', fontSize: 30,
            }}>{round}</div>
          )}
          <div style={{ display: 'flex', marginTop: 26, fontSize: 52 }}>{headline}</div>
          <div style={{ display: 'flex', marginTop: 18, fontSize: 34, color: '#bd2c1d' }}>{brand}</div>
          <div style={{ display: 'flex', fontSize: name.length > 10 ? 76 : 96, color: '#e8432f', lineHeight: 1.1 }}>{name}</div>
          <div style={{ display: 'flex', marginTop: 34, fontSize: 30, color: '#655e55' }}>{footer}</div>
        </div>
      </div>
    ),
    { ...size, ...(font ? { fonts: [{ name: 'Black Han Sans', data: font, style: 'normal', weight: 400 }] } : {}) },
  );
}

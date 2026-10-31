import { ImageResponse } from 'next/og';
import { loadOgFont } from '@/lib/ogFont';
import { fetchWorldcupShare } from '@/lib/worldcupShare';

/** 카카오톡·메신저 등에 링크를 보냈을 때 보이는 미리보기 이미지 (1200x630) */
export const alt = 'BURGER PICK 햄버거 월드컵 결과';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image({ params }: { params: Promise<{ sessionId: string }> }) {
  const share = await fetchWorldcupShare((await params).sessionId).catch(() => null);
  const brand = share?.winner.brandName ?? 'BURGER PICK';
  const name = share?.winner.name ?? '햄버거 월드컵';
  const headline = share ? '나의 최애 버거는' : '오늘의 최애 버거를 골라보세요';
  const round = share ? `${share.roundSize}강 우승` : '';
  const footer = '너의 최애 버거는? BURGER PICK';
  const font = await loadOgFont(`${headline}${brand}${name}${round}${footer}🍔`);

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

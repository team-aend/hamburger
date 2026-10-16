import type { Metadata } from 'next';
import AuthProvider from '@/components/auth/AuthProvider';
import './globals.css';

export const metadata: Metadata = {
  // 공유 미리보기 이미지(og:image)의 절대 주소 기준. 배포 시 NEXT_PUBLIC_SITE_URL 을 실제 도메인으로 설정한다.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Burger Pick | 햄버거 월드컵',
  description: '두 버거 중 하나를 선택해 나만의 최애 버거를 찾아보세요.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
      <body>{children}</body>
    </html>
  );
}

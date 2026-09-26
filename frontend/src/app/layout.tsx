import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Hamburger Project',
  description: 'Next.js Frontend + Node.js (Express) Backend with TypeScript',
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

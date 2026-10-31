import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Docker 이미지용 최소 실행 번들 (.next/standalone) 생성.
  // npm workspaces 라서 추적 기준 경로를 저장소 루트로 지정해야 한다.
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '..'),
  // Keep production builds from replacing files used by the running dev server.
  distDir: process.env.NODE_ENV === 'development' ? '.next-dev' : '.next',
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;

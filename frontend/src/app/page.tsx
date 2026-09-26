'use client';

import { useEffect, useState } from 'react';

interface HealthResponse {
  status: string;
  service: string;
  timestamp: string;
}

export default function HomePage() {
  const [message, setMessage] = useState<string>('백엔드 연결 확인 중...');
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBackendData = async () => {
      try {
        const [helloRes, healthRes] = await Promise.all([
          fetch('/api/hello'),
          fetch('/api/health'),
        ]);

        if (!helloRes.ok || !healthRes.ok) {
          throw new Error('백엔드 응답 실패');
        }

        const helloData = await helloRes.json();
        const healthData = await healthRes.json();

        setMessage(helloData.message);
        setHealth(healthData);
        setError(null);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : '백엔드 서버(Port 4000)와 연결할 수 없습니다.'
        );
      }
    };

    fetchBackendData();
  }, []);

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          maxWidth: '600px',
          width: '100%',
          backgroundColor: 'var(--card-bg)',
          border: '1px solid var(--border-color)',
          borderRadius: '16px',
          padding: '2.5rem',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
        }}
      >
        <h1 style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
          🍔 Hamburger Project
        </h1>
        <p style={{ opacity: 0.75, marginBottom: '2rem' }}>
          Next.js (TypeScript) + Node.js Express (TypeScript) 기본 세팅
        </p>

        <section
          style={{
            padding: '1.25rem',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--background)',
          }}
        >
          <h2 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
            백엔드 API 연동 상태
          </h2>
          {error ? (
            <p style={{ color: '#e03131', fontWeight: 500 }}>⚠️ {error}</p>
          ) : (
            <>
              <p style={{ fontWeight: 500, marginBottom: '0.5rem' }}>
                {message}
              </p>
              {health && (
                <p style={{ fontSize: '0.85rem', opacity: 0.65 }}>
                  Service: {health.service} | Status: {health.status} | Time:{' '}
                  {new Date(health.timestamp).toLocaleTimeString('ko-KR')}
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}

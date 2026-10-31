'use client';

import { useEffect, useState, type ReactNode } from 'react';

interface BurgerImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  fallback?: ReactNode;
  loading?: 'eager' | 'lazy';
}

export default function BurgerImage({
  src,
  alt,
  className,
  fallback = <span aria-hidden="true">🍔</span>,
  loading = 'lazy',
}: BurgerImageProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);

  const safeSrc = src && (/^https?:\/\//i.test(src) || (src.startsWith('/') && !src.startsWith('//')))
    ? src
    : null;

  return safeSrc && !failed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={safeSrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={() => setFailed(true)}
    />
  ) : fallback;
}

'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import './land-return.css';

export default function LandReturnLink() {
  const search = useSearchParams();
  const pathname = usePathname();
  if (search.get('from') !== 'land' || !['/', '/game', '/burger-mbti', '/ranking'].includes(pathname)) return null;
  return <Link className="land-return-link" href="/land"><span aria-hidden="true">←</span> 버거 랜드로 돌아가기</Link>;
}

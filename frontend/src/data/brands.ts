import type { Brand } from '@/types/product';

/**
 * 하드코딩된 Mock Data. DB / API 없이 이 배열이 유일한 브랜드 목록이다.
 *
 * TODO(API): `/api/brands` 연결 시 이 배열을 삭제한다.
 *  - BrandFilter.tsx 가 이 배열을 직접 import 해서 필터 칩을 그리므로,
 *    page.tsx 에서 받은 브랜드 목록을 ProductExplorer -> BrandFilter 로 props 전달하도록 함께 수정해야 한다.
 */
export const BRANDS: Brand[] = [
  { id: 1, name: '맥도날드', slug: 'mcdonalds' },
  { id: 2, name: '버거킹', slug: 'burgerking' },
  { id: 3, name: 'KFC', slug: 'kfc' },
  { id: 4, name: '롯데리아', slug: 'lotteria' },
  { id: 5, name: '맘스터치', slug: 'momstouch' },
  { id: 6, name: '프랭크버거', slug: 'frankburger' },
];

export const ALL_BRANDS = 'ALL';

/** 브랜드 slug로 빠르게 찾기 위한 맵 (Mock Data 작성용) */
export const brandBySlug = Object.fromEntries(
  BRANDS.map((brand) => [brand.slug, brand])
) as Record<string, Brand>;

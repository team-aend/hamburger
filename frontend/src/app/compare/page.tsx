import type { Metadata } from 'next';
import ProductExplorer from '@/components/ProductExplorer';
import { PRODUCTS } from '@/data/products';

export const metadata: Metadata = {
  title: '가격 비교 | Burger Pick',
  description: '여러 브랜드의 햄버거 메뉴를 한 화면에서 찾고 가격과 영양정보를 비교하세요.',
};

/**
 * Server Component.
 *
 * 현재는 하드코딩된 Mock Data(data/products.ts)를 그대로 내려준다.
 * Backend API 가 준비되면 Mock Data 교체는 이 함수 한 곳에서만 하면 되고,
 * ProductExplorer 이하 컴포넌트는 수정할 필요가 없다.
 *
 * TODO(API):
 *   export default async function ComparePage() {
 *     const res = await fetch('http://localhost:4000/api/products', { cache: 'no-store' });
 *     const products: Product[] = await res.json();
 *     return <ProductExplorer products={products} />;
 *   }
 */
export default function ComparePage() {
  return <ProductExplorer products={PRODUCTS} />;
}

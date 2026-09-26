import ProductExplorer from '@/components/ProductExplorer';
import { PRODUCTS } from '@/data/products';

/**
 * Server Component.
 *
 * 현재는 하드코딩된 Mock Data(data/products.ts)를 그대로 내려준다.
 * Backend API 가 준비되면 Mock Data 교체는 이 함수 한 곳에서만 하면 되고,
 * ProductExplorer 이하 컴포넌트는 수정할 필요가 없다.
 *
 * TODO(API):
 *   export default async function HomePage() {
 *     const res = await fetch('http://localhost:4000/api/products', { cache: 'no-store' });
 *     const products: Product[] = await res.json();
 *     return <ProductExplorer products={products} />;
 *   }
 */
export default function HomePage() {
  return <ProductExplorer products={PRODUCTS} />;
}

import type { Metadata } from 'next';
import ProductExplorer from '@/components/ProductExplorer';
import { BRANDS } from '@/data/brands';
import { fetchProducts } from '@/lib/products';
import type { Brand } from '@/types/product';

export const metadata: Metadata = {
  title: '햄버거 비교 | Burger Pick',
  description: '여러 브랜드의 햄버거 메뉴를 한 화면에서 찾고 가격과 영양정보를 비교하세요.',
};

const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

async function getBrands(): Promise<Brand[]> {
  try {
    const res = await fetch(`${backendUrl}/api/brands`, { cache: 'no-store' });
    if (!res.ok) return BRANDS;
    const data = await res.json();
    if (Array.isArray(data.brands) && data.brands.length > 0) {
      return data.brands;
    }
    return BRANDS;
  } catch {
    return BRANDS;
  }
}

export default async function ComparePage() {
  const [brands, products] = await Promise.all([getBrands(), fetchProducts(backendUrl)]);
  return (
    <ProductExplorer
      products={products ?? []}
      initialBrands={brands}
      loadError={products === null ? '햄버거 목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' : undefined}
    />
  );
}

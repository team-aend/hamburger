import type { Metadata } from 'next';
import ProductExplorer from '@/components/ProductExplorer';
import { PRODUCTS } from '@/data/products';
import { BRANDS } from '@/data/brands';
import type { Brand } from '@/types/product';

export const metadata: Metadata = {
  title: '가격 비교 | Burger Pick',
  description: '여러 브랜드의 햄버거 메뉴를 한 화면에서 찾고 가격과 영양정보를 비교하세요.',
};

async function getBrands(): Promise<Brand[]> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
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
  const brands = await getBrands();
  return <ProductExplorer products={PRODUCTS} initialBrands={brands} />;
}

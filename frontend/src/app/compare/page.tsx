import type { Metadata } from 'next';
import ProductExplorer from '@/components/ProductExplorer';
import { PRODUCTS } from '@/data/products';
import { BRANDS } from '@/data/brands';
import type { Brand, Product } from '@/types/product';

export const metadata: Metadata = {
  title: '가격 비교 | Burger Pick',
  description: '여러 브랜드의 햄버거 메뉴를 한 화면에서 찾고 가격과 영양정보를 비교하세요.',
};

interface DbProductImage {
  id: number;
  name: string;
  slug: string;
  imageUrl: string | null;
}

function mergeProductImages(products: Product[], dbImages: DbProductImage[]): Product[] {
  if (!Array.isArray(dbImages) || dbImages.length === 0) return products;
  const norm = (s: string) => s.toLowerCase().replace(/[\s-_]/g, '');
  const bySlug = new Map<string, string>();
  const byName = new Map<string, string>();
  const byId = new Map<number, string>();

  for (const item of dbImages) {
    if (!item.imageUrl) continue;
    bySlug.set(norm(item.slug), item.imageUrl);
    byName.set(norm(item.name), item.imageUrl);
    byId.set(Number(item.id), item.imageUrl);
  }

  return products.map((p) => {
    const dbUrl = bySlug.get(norm(p.slug)) ?? byName.get(norm(p.name)) ?? byId.get(p.id);
    return {
      ...p,
      imageUrl: dbUrl || p.imageUrl,
    };
  });
}

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

async function getProductImages(): Promise<DbProductImage[]> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
    const res = await fetch(`${backendUrl}/api/products/images`, { cache: 'no-store' });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.items) ? data.items : [];
  } catch {
    return [];
  }
}

export default async function ComparePage() {
  const [brands, dbImages] = await Promise.all([getBrands(), getProductImages()]);
  const products = mergeProductImages(PRODUCTS, dbImages);
  return <ProductExplorer products={products} initialBrands={brands} />;
}

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import ProductDetailView from '@/components/product-detail/ProductDetailView';
import type { ProductDetail } from '@/types/productDetail';
import '../product-detail.css';

/**
 * 상품 상세 (/products/:id) — 서버에서 먼저 불러와 바로 보여주고(공유·검색 노출),
 * 좋아요·한 줄 평처럼 로그인에 따라 달라지는 부분은 화면에서 다시 불러온다.
 */
async function fetchProduct(id: string): Promise<ProductDetail | null> {
  if (!/^\d+$/.test(id)) return null;
  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  const res = await fetch(`${backendUrl}/api/products/${id}`, { cache: 'no-store' });
  if (res.status === 404 || res.status === 400) return null;
  if (!res.ok) throw new Error(`상품 정보를 불러오지 못했습니다. (${res.status})`);
  return (await res.json()).product;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const product = await fetchProduct((await params).id).catch(() => null);
  if (!product) return { title: '버거를 찾을 수 없어요 | Burger Pick' };
  return {
    title: `${product.name} - ${product.brand.name} | Burger Pick`,
    description: product.description || `${product.brand.name} ${product.name}의 가격, 가격 추이, 영양 정보와 한 줄 평`,
  };
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const product = await fetchProduct((await params).id);
  if (!product) notFound();
  return <ProductDetailView product={product} />;
}

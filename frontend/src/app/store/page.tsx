import type { Metadata } from 'next';
import StoreScene from '@/components/store/StoreScene';
import './store.css';

export const metadata: Metadata = {
  title: '버거픽 매장 | Burger Pick',
  description: '3D 버거픽 매장에 들어가 자리에 앉고, 키오스크로 주문해서 버거를 먹어 보세요.',
};

// 화면 전체를 3D 매장으로 쓰기 때문에 사이트 헤더·푸터 없이 띄운다 (왼쪽 위 ⟵ 로 나가기)
export default function StorePage() {
  return (
    <main className="store-shell">
      <StoreScene />
    </main>
  );
}

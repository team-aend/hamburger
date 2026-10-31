import type { Metadata } from 'next';
import BurgerLand from '@/components/land/BurgerLand';
import './land.css';

export const metadata: Metadata = {
  title: '버거 랜드 | Burger Pick',
  description: '작은 버거 마을에서 만나는 월드컵, 햄버거 쌓기, 취향 테스트. 오늘은 어디서 놀까요?',
};

export default function LandPage() {
  return <BurgerLand />;
}

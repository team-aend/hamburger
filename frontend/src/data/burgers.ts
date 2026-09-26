export type Burger = {
  id: string;
  name: string;
  brand: string;
  description: string;
  accent: string;
  emoji: string;
};

export const burgers: Burger[] = [
  { id: 'classic-cheese', name: '클래식 치즈버거', brand: 'BURGER PICK', description: '진한 체더와 육즙 가득 소고기 패티', accent: '#f0b735', emoji: '🍔' },
  { id: 'double-smash', name: '더블 스매시', brand: 'SMASH HOUSE', description: '바삭하게 눌러 구운 두 장의 패티', accent: '#d84a30', emoji: '🥩' },
  { id: 'shrimp-crunch', name: '크런치 쉬림프', brand: 'OCEAN BUN', description: '통새우 패티와 산뜻한 타르타르', accent: '#ef8c72', emoji: '🍤' },
  { id: 'avocado-green', name: '아보카도 그린', brand: 'GREEN TABLE', description: '부드러운 아보카도와 신선한 채소', accent: '#6f994d', emoji: '🥑' },
  { id: 'spicy-chicken', name: '스파이시 치킨', brand: 'HOT BIRD', description: '매콤한 소스와 바삭한 치킨 패티', accent: '#d93529', emoji: '🌶️' },
  { id: 'mushroom-melt', name: '머쉬룸 멜트', brand: 'FOREST GRILL', description: '볶은 버섯과 녹진한 스위스 치즈', accent: '#8a684c', emoji: '🍄' },
  { id: 'bacon-bbq', name: '베이컨 BBQ', brand: 'SMOKE YARD', description: '훈연 베이컨과 달콤한 바비큐 소스', accent: '#a84c2e', emoji: '🥓' },
  { id: 'chili-cheese', name: '칠리 치즈 폭탄', brand: 'TEXAS BUN', description: '매콤한 칠리와 쏟아지는 치즈', accent: '#e16b24', emoji: '🧀' },
  { id: 'truffle-burger', name: '트러플 블랙', brand: 'NOIR BURGER', description: '트러플 향을 더한 프리미엄 버거', accent: '#35312d', emoji: '🖤' },
  { id: 'hawaiian', name: '하와이안 선셋', brand: 'ALOHA GRILL', description: '구운 파인애플의 달콤한 반전', accent: '#f1a62b', emoji: '🍍' },
  { id: 'blue-cheese', name: '블루 치즈 버거', brand: 'BLUE FARM', description: '알싸한 블루치즈와 캐러멜 양파', accent: '#526b94', emoji: '🧅' },
  { id: 'egg-morning', name: '선라이즈 에그', brand: 'MORNING BUN', description: '반숙 달걀을 올린 든든한 한 끼', accent: '#efb838', emoji: '🍳' },
  { id: 'bulgogi', name: '서울 불고기 버거', brand: 'SEOUL GRILL', description: '달콤 짭짤한 불고기 소스와 패티', accent: '#70432d', emoji: '🥢' },
  { id: 'fish-tartar', name: '피시 타르타르', brand: 'PORT 27', description: '담백한 생선 패티와 피클 타르타르', accent: '#4d8ba0', emoji: '🐟' },
  { id: 'onion-ring', name: '어니언 크런치', brand: 'RING & BUN', description: '큼직한 어니언링의 경쾌한 식감', accent: '#d89039', emoji: '🧅' },
  { id: 'veggie-bean', name: '가든 빈 버거', brand: 'PLANT CLUB', description: '고소한 콩 패티와 허브 드레싱', accent: '#4f814d', emoji: '🌱' },
];

export interface Category {
  id: number;
  name: string;
  slug: string;
}

export interface Brand {
  id: number;
  name: string;
  slug: string;
  logoUrl?: string;
  homepageUrl?: string;
  isActive: boolean;
}

export type IngredientGroup = 'PATTY' | 'TOPPING' | 'CHEESE_SAUCE';

export interface Ingredient {
  id: number;
  name: string;
  slug: string;
  group: IngredientGroup;
}

export interface Tag {
  id: number;
  name: string;
  slug: string;
}

export interface Product {
  id: number;
  brandId: number;
  categoryId: number;
  name: string;
  slug: string;
  description: string;
  imageUrl?: string;
  status: 'ACTIVE' | 'DISCONTINUED' | 'UPCOMING' | 'TEMPORARY';
  isLimited: boolean;
}

export interface ProductVariant {
  id: number;
  productId: number;
  name: string;
  variantType: 'SINGLE' | 'SET';
  isDefault: boolean;
  isActive: boolean;
}

export interface ProductPrice {
  id: number;
  productVariantId: number;
  price: number;
  channel: 'STORE' | 'DELIVERY';
  startedAt: string;
  endedAt: string | null;
}

export interface Nutrition {
  id: number;
  productVariantId: number;
  servingSizeG: number;
  caloriesKcal: number;
  proteinG: number;
  sugarG: number;
  saturatedFatG: number;
  sodiumMg: number;
}

export interface ProductIngredient {
  productId: number;
  ingredientId: number;
  sortOrder: number;
}

export interface ProductTag {
  productId: number;
  tagId: number;
}

// 1. Categories
export const categories: Category[] = [
  { id: 1, name: '햄버거', slug: 'burger' },
  { id: 2, name: '피자', slug: 'pizza' },
  { id: 3, name: '치킨', slug: 'chicken' },
  { id: 4, name: '사이드', slug: 'side' },
  { id: 5, name: '음료', slug: 'drink' },
];

// 2. Brands
export const brands: Brand[] = [
  { id: 1, name: '맥도날드', slug: 'mcdonalds', isActive: true },
  { id: 2, name: '버거킹', slug: 'burgerking', isActive: true },
  { id: 3, name: '맘스터치', slug: 'momstouch', isActive: true },
  { id: 4, name: '롯데리아', slug: 'lotteria', isActive: true },
  { id: 5, name: 'KFC', slug: 'kfc', isActive: true },
  { id: 6, name: '프랭크버거', slug: 'frankburger', isActive: true },
];

// 3. Ingredients (버거 재료)
export const ingredients: Ingredient[] = [
  // 패티류 (PATTY)
  { id: 1, name: '치킨 패티', slug: 'chicken-patty', group: 'PATTY' },
  { id: 2, name: '소고기 패티', slug: 'beef-patty', group: 'PATTY' },
  { id: 3, name: '새우 패티', slug: 'shrimp-patty', group: 'PATTY' },
  { id: 4, name: '불고기 패티', slug: 'bulgogi-patty', group: 'PATTY' },

  // 채소 및 토핑 (TOPPING)
  { id: 5, name: '토마토', slug: 'tomato', group: 'TOPPING' },
  { id: 6, name: '양상추', slug: 'lettuce', group: 'TOPPING' },
  { id: 7, name: '양파', slug: 'onion', group: 'TOPPING' },
  { id: 8, name: '피클', slug: 'pickle', group: 'TOPPING' },
  { id: 9, name: '베이컨', slug: 'bacon', group: 'TOPPING' },
  { id: 10, name: '해시브라운', slug: 'hashbrown', group: 'TOPPING' },
  { id: 11, name: '계란(에그)', slug: 'egg', group: 'TOPPING' },
  { id: 12, name: '할라피뇨', slug: 'jalapeno', group: 'TOPPING' },

  // 치즈 및 소스 (CHEESE_SAUCE)
  { id: 13, name: '치즈', slug: 'cheese', group: 'CHEESE_SAUCE' },
  { id: 14, name: '매콤 소스', slug: 'spicy-sauce', group: 'CHEESE_SAUCE' },
  { id: 15, name: '마요 소스', slug: 'mayo-sauce', group: 'CHEESE_SAUCE' },
];

// 4. Tags
export const tags: Tag[] = [
  { id: 1, name: '치킨', slug: 'chicken' },
  { id: 2, name: '비프', slug: 'beef' },
  { id: 3, name: '매콤', slug: 'spicy' },
  { id: 4, name: '치즈', slug: 'cheese' },
  { id: 5, name: '베스트셀러', slug: 'bestseller' },
  { id: 6, name: '고단백', slug: 'high-protein' },
];

// 5. Products
export const products: Product[] = [
  {
    id: 1,
    brandId: 1,
    categoryId: 1,
    name: '빅맥',
    slug: 'big-mac',
    description: '순쇠고기 패티 두 장에 특별한 빅맥 소스, 치즈, 양상추, 피클, 양파가 어우러진 대표 버거',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 2,
    brandId: 1,
    categoryId: 1,
    name: '맥스파이시 상하이 버거',
    slug: 'mcspicy-shanghai-burger',
    description: '매콤한 시즈닝을 입힌 100% 통닭가슴살 패티 위에 아삭한 양상추와 신선한 토마토',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 3,
    brandId: 1,
    categoryId: 1,
    name: '맥치킨 모짜렐라',
    slug: 'mcchicken-mozzarella',
    description: '바삭한 치킨 패티와 고소한 모짜렐라 치즈스틱 2개, 매콤한 아라비아따 소스의 조화 (토마토 미포함)',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 4,
    brandId: 1,
    categoryId: 1,
    name: '베이컨 토마토 디럭스',
    slug: 'bacon-tomato-deluxe',
    description: '두 장의 순쇠고기 패티에 그릴에 구운 베이컨, 신선한 토마토와 양상추, 스위트 칠리 소스',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 5,
    brandId: 2,
    categoryId: 1,
    name: '와퍼',
    slug: 'whopper',
    description: '직화로 구운 100% 순쇠고기 패티에 토마토, 양상추, 양파, 피클이 들어간 버거킹의 시그니처',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 6,
    brandId: 2,
    categoryId: 1,
    name: '콰트로치즈와퍼',
    slug: 'quattro-cheese-whopper',
    description: '모짜렐라, 아메리칸, 파마산, 체다 4가지 치즈와 직화 소고기 패티의 진한 풍미 (토마토·피클 미포함)',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 7,
    brandId: 2,
    categoryId: 1,
    name: '롱치킨버거',
    slug: 'long-chicken-burger',
    description: '바삭한 치킨 패티 위에 아삭한 양상추와 고소한 마요네즈 소스를 듬뿍 넣은 담백한 치킨버거',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 8,
    brandId: 2,
    categoryId: 1,
    name: '통새우와퍼',
    slug: 'shrimp-whopper',
    description: '직화 순쇠고기 패티에 갈릭페퍼 통새우와 스파이시 토마토소스가 더해진 인기 메뉴',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 9,
    brandId: 3,
    categoryId: 1,
    name: '싸이버거',
    slug: 'thigh-burger',
    description: '바삭하고 매콤한 통다리살 치킨 패티와 신선한 양상추, 양파, 특제 화이트 마요 소스의 조화',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 10,
    brandId: 3,
    categoryId: 1,
    name: '딥치즈버거',
    slug: 'deep-cheese-burger',
    description: '통다리살 치킨 패티에 진한 크림치즈와 체다치즈 소스가 듬뿍 들어간 치즈 매니아 추천 메뉴',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 11,
    brandId: 3,
    categoryId: 1,
    name: '화이트갈릭버거',
    slug: 'white-garlic-burger',
    description: '부드러운 화이트갈릭 소스에 통가슴살 치킨 패티, 슬라이스 햄/베이컨과 치즈를 더한 묵직한 버거',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 12,
    brandId: 3,
    categoryId: 1,
    name: '인크레더블버거',
    slug: 'incredible-burger',
    description: '통다리살 치킨 패티에 에그프라이, 베이컨, 양상추를 풍성하게 쌓은 프리미엄 버거',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 13,
    brandId: 4,
    categoryId: 1,
    name: '새우버거',
    slug: 'shrimp-burger',
    description: '바삭한 통새우살 패티와 특제 타르타르 마요 소스, 양상추가 어우러진 오리지널 베스트셀러',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 14,
    brandId: 4,
    categoryId: 1,
    name: '리아 불고기버거',
    slug: 'ria-bulgogi-burger',
    description: '달콤짭짤한 한국식 불고기 소스와 패티, 신선한 양상추와 양파가 조화를 이루는 대표 버거',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 15,
    brandId: 5,
    categoryId: 1,
    name: '징거버거',
    slug: 'zinger-burger',
    description: '바삭하고 매콤한 통가슴살 치킨 필렛에 상큼한 토마토와 양상추가 어우러진 KFC 대표 버거',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 16,
    brandId: 5,
    categoryId: 1,
    name: '커넬골드문버거',
    slug: 'kernel-goldmoon-burger',
    description: '촉촉한 통다리살 치킨 필렛에 반숙 에그 패티, 고소한 치즈와 베이컨, 할라피뇨 마요 소스 (토마토 미포함)',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 17,
    brandId: 6,
    categoryId: 1,
    name: '프랭크버거',
    slug: 'frank-burger',
    description: '육즙 가득한 수제 스타일 소고기 패티에 신선한 토마토, 양상추, 구운 양파와 치즈',
    status: 'ACTIVE',
    isLimited: false,
  },
  {
    id: 18,
    brandId: 6,
    categoryId: 1,
    name: 'JG치즈버거',
    slug: 'jg-cheese-burger',
    description: '더블 치즈와 육즙 가득 소고기 패티, 베이컨과 피클의 진한 아메리칸 치즈버거 (토마토 미포함)',
    status: 'ACTIVE',
    isLimited: false,
  },
];

// Helper to build ProductVariants, ProductPrices, and Nutrition systematically
interface SeedVariantInput {
  productId: number;
  singleStorePrice: number;
  singleDeliveryPrice: number;
  setStorePrice: number;
  setDeliveryPrice: number;
  singleNutrition: Omit<Nutrition, 'id' | 'productVariantId'>;
  setNutrition: Omit<Nutrition, 'id' | 'productVariantId'>;
  ingredientSlugs: string[];
  tagSlugs: string[];
}

const seedConfig: SeedVariantInput[] = [
  {
    productId: 1, // 빅맥
    singleStorePrice: 5500,
    singleDeliveryPrice: 6300,
    setStorePrice: 6900,
    setDeliveryPrice: 7800,
    singleNutrition: { servingSizeG: 223, caloriesKcal: 583, proteinG: 27, sugarG: 7, saturatedFatG: 11, sodiumMg: 902 },
    setNutrition: { servingSizeG: 615, caloriesKcal: 910, proteinG: 31, sugarG: 42, saturatedFatG: 13, sodiumMg: 1150 },
    ingredientSlugs: ['beef-patty', 'cheese', 'lettuce', 'pickle', 'onion', 'mayo-sauce'],
    tagSlugs: ['beef', 'cheese', 'bestseller'],
  },
  {
    productId: 2, // 맥스파이시 상하이 버거
    singleStorePrice: 5500,
    singleDeliveryPrice: 6300,
    setStorePrice: 6900,
    setDeliveryPrice: 7800,
    singleNutrition: { servingSizeG: 235, caloriesKcal: 501, proteinG: 24, sugarG: 8, saturatedFatG: 3, sodiumMg: 894 },
    setNutrition: { servingSizeG: 627, caloriesKcal: 830, proteinG: 28, sugarG: 43, saturatedFatG: 5, sodiumMg: 1140 },
    ingredientSlugs: ['chicken-patty', 'tomato', 'lettuce', 'mayo-sauce', 'spicy-sauce'],
    tagSlugs: ['chicken', 'spicy', 'bestseller'],
  },
  {
    productId: 3, // 맥치킨 모짜렐라
    singleStorePrice: 5000,
    singleDeliveryPrice: 5800,
    setStorePrice: 6900,
    setDeliveryPrice: 7800,
    singleNutrition: { servingSizeG: 293, caloriesKcal: 743, proteinG: 31, sugarG: 16, saturatedFatG: 7, sodiumMg: 1255 },
    setNutrition: { servingSizeG: 685, caloriesKcal: 1060, proteinG: 35, sugarG: 51, saturatedFatG: 9, sodiumMg: 1500 },
    ingredientSlugs: ['chicken-patty', 'cheese', 'lettuce', 'spicy-sauce', 'mayo-sauce'],
    tagSlugs: ['chicken', 'cheese', 'spicy', 'high-protein'],
  },
  {
    productId: 4, // 베이컨 토마토 디럭스
    singleStorePrice: 5800,
    singleDeliveryPrice: 6600,
    setStorePrice: 7400,
    setDeliveryPrice: 8400,
    singleNutrition: { servingSizeG: 245, caloriesKcal: 545, proteinG: 27, sugarG: 10, saturatedFatG: 10, sodiumMg: 836 },
    setNutrition: { servingSizeG: 637, caloriesKcal: 875, proteinG: 31, sugarG: 45, saturatedFatG: 12, sodiumMg: 1080 },
    ingredientSlugs: ['beef-patty', 'bacon', 'tomato', 'lettuce', 'cheese', 'spicy-sauce'],
    tagSlugs: ['beef', 'cheese', 'bestseller'],
  },
  {
    productId: 5, // 와퍼
    singleStorePrice: 7100,
    singleDeliveryPrice: 8100,
    setStorePrice: 9100,
    setDeliveryPrice: 10100,
    singleNutrition: { servingSizeG: 278, caloriesKcal: 722, proteinG: 29, sugarG: 11, saturatedFatG: 13, sodiumMg: 985 },
    setNutrition: { servingSizeG: 678, caloriesKcal: 1050, proteinG: 34, sugarG: 46, saturatedFatG: 16, sodiumMg: 1290 },
    ingredientSlugs: ['beef-patty', 'tomato', 'lettuce', 'onion', 'pickle', 'mayo-sauce'],
    tagSlugs: ['beef', 'bestseller'],
  },
  {
    productId: 6, // 콰트로치즈와퍼
    singleStorePrice: 7900,
    singleDeliveryPrice: 8900,
    setStorePrice: 9900,
    setDeliveryPrice: 10900,
    singleNutrition: { servingSizeG: 309, caloriesKcal: 775, proteinG: 42, sugarG: 8, saturatedFatG: 21, sodiumMg: 1320 },
    setNutrition: { servingSizeG: 709, caloriesKcal: 1103, proteinG: 47, sugarG: 43, saturatedFatG: 24, sodiumMg: 1620 },
    ingredientSlugs: ['beef-patty', 'cheese', 'lettuce', 'onion', 'mayo-sauce'],
    tagSlugs: ['beef', 'cheese', 'high-protein'],
  },
  {
    productId: 7, // 롱치킨버거
    singleStorePrice: 4900,
    singleDeliveryPrice: 5700,
    setStorePrice: 6900,
    setDeliveryPrice: 7700,
    singleNutrition: { servingSizeG: 201, caloriesKcal: 561, proteinG: 21, sugarG: 6, saturatedFatG: 4.5, sodiumMg: 842 },
    setNutrition: { servingSizeG: 601, caloriesKcal: 889, proteinG: 26, sugarG: 41, saturatedFatG: 7, sodiumMg: 1140 },
    ingredientSlugs: ['chicken-patty', 'lettuce', 'mayo-sauce'],
    tagSlugs: ['chicken'],
  },
  {
    productId: 8, // 통새우와퍼
    singleStorePrice: 7900,
    singleDeliveryPrice: 8900,
    setStorePrice: 9900,
    setDeliveryPrice: 10900,
    singleNutrition: { servingSizeG: 315, caloriesKcal: 768, proteinG: 33, sugarG: 12, saturatedFatG: 14, sodiumMg: 1210 },
    setNutrition: { servingSizeG: 715, caloriesKcal: 1096, proteinG: 38, sugarG: 47, saturatedFatG: 17, sodiumMg: 1510 },
    ingredientSlugs: ['beef-patty', 'shrimp-patty', 'tomato', 'lettuce', 'onion', 'pickle', 'spicy-sauce'],
    tagSlugs: ['beef', 'spicy', 'bestseller'],
  },
  {
    productId: 9, // 싸이버거
    singleStorePrice: 4900,
    singleDeliveryPrice: 5400,
    setStorePrice: 7300,
    setDeliveryPrice: 7800,
    singleNutrition: { servingSizeG: 230, caloriesKcal: 594, proteinG: 28, sugarG: 12, saturatedFatG: 7, sodiumMg: 722 },
    setNutrition: { servingSizeG: 630, caloriesKcal: 944, proteinG: 33, sugarG: 45, saturatedFatG: 9, sodiumMg: 1050 },
    ingredientSlugs: ['chicken-patty', 'lettuce', 'onion', 'pickle', 'mayo-sauce', 'spicy-sauce'],
    tagSlugs: ['chicken', 'spicy', 'bestseller', 'high-protein'],
  },
  {
    productId: 10, // 딥치즈버거
    singleStorePrice: 5400,
    singleDeliveryPrice: 5900,
    setStorePrice: 7800,
    setDeliveryPrice: 8300,
    singleNutrition: { servingSizeG: 255, caloriesKcal: 641, proteinG: 32, sugarG: 11, saturatedFatG: 9, sodiumMg: 845 },
    setNutrition: { servingSizeG: 655, caloriesKcal: 991, proteinG: 37, sugarG: 44, saturatedFatG: 11, sodiumMg: 1170 },
    ingredientSlugs: ['chicken-patty', 'cheese', 'lettuce', 'onion', 'pickle', 'mayo-sauce'],
    tagSlugs: ['chicken', 'cheese', 'high-protein'],
  },
  {
    productId: 11, // 화이트갈릭버거
    singleStorePrice: 5500,
    singleDeliveryPrice: 6000,
    setStorePrice: 7900,
    setDeliveryPrice: 8400,
    singleNutrition: { servingSizeG: 260, caloriesKcal: 690, proteinG: 36, sugarG: 13, saturatedFatG: 8, sodiumMg: 980 },
    setNutrition: { servingSizeG: 660, caloriesKcal: 1040, proteinG: 41, sugarG: 46, saturatedFatG: 10, sodiumMg: 1300 },
    ingredientSlugs: ['chicken-patty', 'bacon', 'cheese', 'lettuce', 'onion', 'pickle', 'mayo-sauce'],
    tagSlugs: ['chicken', 'cheese', 'high-protein'],
  },
  {
    productId: 12, // 인크레더블버거
    singleStorePrice: 6000,
    singleDeliveryPrice: 6500,
    setStorePrice: 8400,
    setDeliveryPrice: 8900,
    singleNutrition: { servingSizeG: 302, caloriesKcal: 714, proteinG: 35, sugarG: 14, saturatedFatG: 10, sodiumMg: 1060 },
    setNutrition: { servingSizeG: 702, caloriesKcal: 1064, proteinG: 40, sugarG: 47, saturatedFatG: 12, sodiumMg: 1380 },
    ingredientSlugs: ['chicken-patty', 'egg', 'bacon', 'lettuce', 'onion', 'pickle', 'mayo-sauce'],
    tagSlugs: ['chicken', 'high-protein'],
  },
  {
    productId: 13, // 새우버거
    singleStorePrice: 4800,
    singleDeliveryPrice: 5500,
    setStorePrice: 6900,
    setDeliveryPrice: 7700,
    singleNutrition: { servingSizeG: 179, caloriesKcal: 492, proteinG: 16, sugarG: 8, saturatedFatG: 5, sodiumMg: 820 },
    setNutrition: { servingSizeG: 579, caloriesKcal: 812, proteinG: 20, sugarG: 41, saturatedFatG: 7, sodiumMg: 1100 },
    ingredientSlugs: ['shrimp-patty', 'lettuce', 'mayo-sauce'],
    tagSlugs: ['bestseller'],
  },
  {
    productId: 14, // 리아 불고기버거
    singleStorePrice: 4800,
    singleDeliveryPrice: 5500,
    setStorePrice: 6900,
    setDeliveryPrice: 7700,
    singleNutrition: { servingSizeG: 188, caloriesKcal: 476, proteinG: 20, sugarG: 10, saturatedFatG: 6, sodiumMg: 790 },
    setNutrition: { servingSizeG: 588, caloriesKcal: 796, proteinG: 24, sugarG: 43, saturatedFatG: 8, sodiumMg: 1070 },
    ingredientSlugs: ['bulgogi-patty', 'lettuce', 'onion', 'mayo-sauce'],
    tagSlugs: ['bestseller'],
  },
  {
    productId: 15, // 징거버거
    singleStorePrice: 5500,
    singleDeliveryPrice: 6200,
    setStorePrice: 7800,
    setDeliveryPrice: 8600,
    singleNutrition: { servingSizeG: 222, caloriesKcal: 466, proteinG: 26, sugarG: 6, saturatedFatG: 4.2, sodiumMg: 830 },
    setNutrition: { servingSizeG: 622, caloriesKcal: 796, proteinG: 30, sugarG: 39, saturatedFatG: 6.5, sodiumMg: 1120 },
    ingredientSlugs: ['chicken-patty', 'tomato', 'lettuce', 'mayo-sauce', 'spicy-sauce'],
    tagSlugs: ['chicken', 'spicy', 'bestseller'],
  },
  {
    productId: 16, // 커넬골드문버거
    singleStorePrice: 6300,
    singleDeliveryPrice: 7000,
    setStorePrice: 8600,
    setDeliveryPrice: 9400,
    singleNutrition: { servingSizeG: 268, caloriesKcal: 635, proteinG: 34, sugarG: 9, saturatedFatG: 8.5, sodiumMg: 1020 },
    setNutrition: { servingSizeG: 668, caloriesKcal: 965, proteinG: 38, sugarG: 42, saturatedFatG: 11, sodiumMg: 1310 },
    ingredientSlugs: ['chicken-patty', 'egg', 'bacon', 'cheese', 'jalapeno', 'lettuce', 'mayo-sauce'],
    tagSlugs: ['chicken', 'cheese', 'spicy', 'high-protein'],
  },
  {
    productId: 17, // 프랭크버거
    singleStorePrice: 4600,
    singleDeliveryPrice: 5100,
    setStorePrice: 7600,
    setDeliveryPrice: 8200,
    singleNutrition: { servingSizeG: 205, caloriesKcal: 538, proteinG: 24, sugarG: 7, saturatedFatG: 10, sodiumMg: 680 },
    setNutrition: { servingSizeG: 605, caloriesKcal: 860, proteinG: 28, sugarG: 40, saturatedFatG: 12, sodiumMg: 960 },
    ingredientSlugs: ['beef-patty', 'tomato', 'lettuce', 'onion', 'cheese', 'mayo-sauce'],
    tagSlugs: ['beef', 'cheese', 'bestseller'],
  },
  {
    productId: 18, // JG치즈버거
    singleStorePrice: 5600,
    singleDeliveryPrice: 6100,
    setStorePrice: 8600,
    setDeliveryPrice: 9200,
    singleNutrition: { servingSizeG: 215, caloriesKcal: 595, proteinG: 29, sugarG: 6, saturatedFatG: 14, sodiumMg: 890 },
    setNutrition: { servingSizeG: 615, caloriesKcal: 917, proteinG: 33, sugarG: 39, saturatedFatG: 16, sodiumMg: 1170 },
    ingredientSlugs: ['beef-patty', 'cheese', 'bacon', 'onion', 'pickle'],
    tagSlugs: ['beef', 'cheese', 'high-protein'],
  },
];

export const productVariants: ProductVariant[] = [];
export const productPrices: ProductPrice[] = [];
export const nutritions: Nutrition[] = [];
export const productIngredients: ProductIngredient[] = [];
export const productTags: ProductTag[] = [];

let variantIdSeq = 1;
let priceIdSeq = 1;
let nutritionIdSeq = 1;

for (const item of seedConfig) {
  // 1. SINGLE Variant
  const singleVariantId = variantIdSeq++;
  productVariants.push({
    id: singleVariantId,
    productId: item.productId,
    name: '단품',
    variantType: 'SINGLE',
    isDefault: true,
    isActive: true,
  });

  productPrices.push(
    {
      id: priceIdSeq++,
      productVariantId: singleVariantId,
      price: item.singleStorePrice,
      channel: 'STORE',
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: null,
    },
    {
      id: priceIdSeq++,
      productVariantId: singleVariantId,
      price: item.singleDeliveryPrice,
      channel: 'DELIVERY',
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: null,
    }
  );

  nutritions.push({
    id: nutritionIdSeq++,
    productVariantId: singleVariantId,
    ...item.singleNutrition,
  });

  // 2. SET Variant
  const setVariantId = variantIdSeq++;
  productVariants.push({
    id: setVariantId,
    productId: item.productId,
    name: '세트',
    variantType: 'SET',
    isDefault: false,
    isActive: true,
  });

  productPrices.push(
    {
      id: priceIdSeq++,
      productVariantId: setVariantId,
      price: item.setStorePrice,
      channel: 'STORE',
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: null,
    },
    {
      id: priceIdSeq++,
      productVariantId: setVariantId,
      price: item.setDeliveryPrice,
      channel: 'DELIVERY',
      startedAt: '2026-01-01T00:00:00Z',
      endedAt: null,
    }
  );

  nutritions.push({
    id: nutritionIdSeq++,
    productVariantId: setVariantId,
    ...item.setNutrition,
  });

  // 3. Product Ingredients
  item.ingredientSlugs.forEach((slug, index) => {
    const ing = ingredients.find((i) => i.slug === slug);
    if (ing) {
      productIngredients.push({
        productId: item.productId,
        ingredientId: ing.id,
        sortOrder: index + 1,
      });
    }
  });

  // 4. Product Tags
  item.tagSlugs.forEach((slug) => {
    const tag = tags.find((t) => t.slug === slug);
    if (tag) {
      productTags.push({
        productId: item.productId,
        tagId: tag.id,
      });
    }
  });
}

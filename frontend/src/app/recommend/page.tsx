'use client';

import SiteHeader from '@/components/SiteHeader';
import './recommend.css';

import { useEffect, useState, useCallback, useRef } from 'react';

interface Brand {
  id: number;
  name: string;
  slug: string;
}

interface Ingredient {
  id: number;
  name: string;
  slug: string;
  group: 'PATTY' | 'TOPPING' | 'CHEESE_SAUCE';
}

interface Tag {
  id: number;
  name: string;
  slug: string;
}

interface Nutrition {
  servingSizeG: number;
  caloriesKcal: number;
  proteinG: number;
  sugarG: number;
  saturatedFatG: number;
  sodiumMg: number;
}

interface VariantInfo {
  id: number;
  name: string;
  variantType: 'SINGLE' | 'SET';
  isDefault: boolean;
  prices: {
    store: number;
    delivery: number;
  };
  nutrition: Nutrition;
}

interface RecommendedBurger {
  id: number;
  name: string;
  slug: string;
  description: string;
  brand: Brand;
  ingredients: Ingredient[];
  tags: Tag[];
  variants: VariantInfo[];
  activeVariant: VariantInfo;
}

interface FilterMetadata {
  brands: Brand[];
  ingredients: Ingredient[];
  tags: Tag[];
  calorieRange: {
    min: number;
    max: number;
    step: number;
  };
  priceRange: {
    min: number;
    max: number;
    step: number;
  };
}

type SectionKey = 'brand' | 'include' | 'exclude' | 'price' | 'calories';

export default function RecommendPage() {
  // 필터 메타데이터 상태
  const [metadata, setMetadata] = useState<FilterMetadata | null>(null);

  // 사용자 선택 조건 상태
  const [keyword, setKeyword] = useState<string>('');
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [includeIngredients, setIncludeIngredients] = useState<string[]>([
    'chicken-patty',
  ]);
  const [excludeIngredients, setExcludeIngredients] = useState<string[]>([
    'tomato',
  ]);
  const [minPrice, setMinPrice] = useState<number | null>(null);
  const [maxPrice, setMaxPrice] = useState<number | null>(null);
  const [priceChannel, setPriceChannel] = useState<'STORE' | 'DELIVERY'>(
    'STORE'
  );
  const [maxCalories, setMaxCalories] = useState<number | null>(900);
  const [variantType, setVariantType] = useState<'SINGLE' | 'SET'>('SINGLE');
  const [sortBy, setSortBy] = useState<string>('calories_asc');

  // 아코디언(자세히 보기 / 접기) 상태 — 기본적으로 모두 컴팩트하게 접어두어 모바일 스크롤 최소화
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    brand: false,
    include: false,
    exclude: false,
    price: false,
    calories: false,
  });

  const toggleSection = (key: SectionKey) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isAllExpanded = Object.values(openSections).every(Boolean);
  const toggleAllSections = () => {
    const nextState = !isAllExpanded;
    setOpenSections({
      brand: nextState,
      include: nextState,
      exclude: nextState,
      price: nextState,
      calories: nextState,
    });
  };

  // 추천 결과 상태
  const [items, setItems] = useState<RecommendedBurger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 랜덤 뽑기 모달 상태 (방안 A: 현재 조건 연동형 랜덤 뽑기)
  const [isRandomModalOpen, setIsRandomModalOpen] = useState<boolean>(false);
  const [isRolling, setIsRolling] = useState<boolean>(false);
  const [rollingPreviewName, setRollingPreviewName] = useState<string>('');
  const [randomPicked, setRandomPicked] = useState<RecommendedBurger | null>(
    null
  );
  const [randomTotalCandidates, setRandomTotalCandidates] = useState<number>(0);
  const rollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(
    null
  );

  // 현재 조건 쿼리스트링 빌더
  const buildFilterParams = useCallback(
    (excludeProductId?: number) => {
      const params = new URLSearchParams();
      if (keyword.trim().length > 0) {
        params.set('keyword', keyword.trim());
      }
      if (selectedBrands.length > 0) {
        params.set('brands', selectedBrands.join(','));
      }
      if (includeIngredients.length > 0) {
        params.set('includeIngredients', includeIngredients.join(','));
      }
      if (excludeIngredients.length > 0) {
        params.set('excludeIngredients', excludeIngredients.join(','));
      }
      if (minPrice !== null && !Number.isNaN(minPrice)) {
        params.set('minPrice', String(minPrice));
      }
      if (maxPrice !== null && !Number.isNaN(maxPrice)) {
        params.set('maxPrice', String(maxPrice));
      }
      params.set('priceChannel', priceChannel);
      if (maxCalories !== null) {
        params.set('maxCalories', String(maxCalories));
      }
      params.set('variantType', variantType);
      params.set('sortBy', sortBy);
      if (excludeProductId !== undefined) {
        params.set('excludeProductId', String(excludeProductId));
      }
      return params;
    },
    [
      keyword,
      selectedBrands,
      includeIngredients,
      excludeIngredients,
      minPrice,
      maxPrice,
      priceChannel,
      maxCalories,
      variantType,
      sortBy,
    ]
  );

  const metadataLoadedRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 1. 수동 DB/캐시 강제 동기화 버튼 핸들러 (?refresh=true로 Node.js 인메모리 캐시 갱신)
  const fetchFiltersAndBrands = useCallback(async () => {
    setLoading(true);
    try {
      const params = buildFilterParams();
      params.set('includeFilters', 'true');
      params.set('refresh', 'true');

      const res = await fetch(`/api/recommend?${params.toString()}`);
      if (!res.ok) {
        throw new Error('Supabase DB 동기화에 실패했습니다.');
      }
      const data = await res.json();
      if (data.filters) {
        setMetadata(data.filters);
        metadataLoadedRef.current = true;
      }
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : '백엔드 서버(Port 4000) 연결을 확인해 주세요.'
      );
    } finally {
      setLoading(false);
    }
  }, [buildFilterParams]);

  // 2. 초기 진입(필터 메타데이터 + 추천 결과 1회 통합 호출) 및 조건 변경 시 맞춤 추천 메뉴 조회
  const fetchRecommendations = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    try {
      const params = buildFilterParams();
      if (!metadataLoadedRef.current) {
        params.set('includeFilters', 'true');
      }

      const res = await fetch(`/api/recommend?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('추천 메뉴 조회에 실패했습니다.');
      const data = await res.json();

      if (data.filters) {
        setMetadata(data.filters);
        metadataLoadedRef.current = true;
      }
      setItems(data.items || []);
      setError(null);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setError(
        err instanceof Error
          ? err.message
          : '추천 결과를 불러오는 중 오류가 발생했습니다.'
      );
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  }, [buildFilterParams]);

  useEffect(() => {
    fetchRecommendations();
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [fetchRecommendations]);

  // 3. 현재 조건(또는 전체)에서 랜덤 1개 뽑기 실행
  const handleRandomDraw = async (excludeProductId?: number) => {
    if (items.length === 0) return;

    setIsRandomModalOpen(true);
    setIsRolling(true);

    if (rollingIntervalRef.current) {
      clearInterval(rollingIntervalRef.current);
    }
    let idx = 0;
    rollingIntervalRef.current = setInterval(() => {
      const candidate = items[idx % items.length];
      setRollingPreviewName(`${candidate.brand.name} ${candidate.name}`);
      idx++;
    }, 75);

    try {
      const params = buildFilterParams(excludeProductId);
      const [res] = await Promise.all([
        fetch(`/api/recommend/random?${params.toString()}`),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);

      if (!res.ok) throw new Error('랜덤 추천 요청에 실패했습니다.');
      const data = await res.json();
      setRandomPicked(data.picked || null);
      setRandomTotalCandidates(data.totalCandidates || items.length);
    } catch {
      const fallbackPool =
        excludeProductId && items.length > 1
          ? items.filter((i) => i.id !== excludeProductId)
          : items;
      const picked =
        fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
      setRandomPicked(picked);
      setRandomTotalCandidates(items.length);
    } finally {
      if (rollingIntervalRef.current) {
        clearInterval(rollingIntervalRef.current);
        rollingIntervalRef.current = null;
      }
      setIsRolling(false);
    }
  };

  // 브랜드 토글
  const toggleBrand = (slug: string) => {
    setSelectedBrands((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // 포함할 재료 토글 (제외 목록에 있으면 자동 해제)
  const toggleIncludeIngredient = (slug: string) => {
    setExcludeIngredients((prev) => prev.filter((s) => s !== slug));
    setIncludeIngredients((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // 제외할 재료("OO 빼고") 토글 (포함 목록에 있으면 자동 해제)
  const toggleExcludeIngredient = (slug: string) => {
    setIncludeIngredients((prev) => prev.filter((s) => s !== slug));
    setExcludeIngredients((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  };

  // 원클릭 프리셋 적용
  const applyPreset = (preset: {
    brands?: string[];
    include: string[];
    exclude: string[];
    minP?: number | null;
    maxP?: number | null;
    maxCal: number | null;
    variant?: 'SINGLE' | 'SET';
  }) => {
    setKeyword('');
    setSelectedBrands(preset.brands || []);
    setIncludeIngredients(preset.include);
    setExcludeIngredients(preset.exclude);
    setMinPrice(preset.minP ?? null);
    setMaxPrice(preset.maxP ?? null);
    setMaxCalories(preset.maxCal);
    if (preset.variant) setVariantType(preset.variant);
  };

  // 조건 전체 초기화
  const resetAllFilters = () => {
    setKeyword('');
    setSelectedBrands([]);
    setIncludeIngredients([]);
    setExcludeIngredients([]);
    setMinPrice(null);
    setMaxPrice(null);
    setPriceChannel('STORE');
    setMaxCalories(null);
    setVariantType('SINGLE');
    setSortBy('calories_asc');
  };

  const getIngredientName = (slug: string) =>
    metadata?.ingredients.find((i) => i.slug === slug)?.name || slug;

  const getBrandName = (slug: string) =>
    metadata?.brands.find((b) => b.slug === slug)?.name || slug;

  // 현재 설정된 필터가 하나라도 있는지 여부
  const hasAnyActiveFilter =
    keyword.trim().length > 0 ||
    selectedBrands.length > 0 ||
    includeIngredients.length > 0 ||
    excludeIngredients.length > 0 ||
    minPrice !== null ||
    maxPrice !== null ||
    maxCalories !== null;

  // 금액 조건 요약 텍스트 생성
  const formatPriceSummary = () => {
    const channelLabel = priceChannel === 'DELIVERY' ? '배달가' : '매장가';
    if (minPrice === null && maxPrice === null) return `${channelLabel} 전체`;
    if (minPrice !== null && maxPrice !== null) {
      return `${channelLabel} ${minPrice.toLocaleString()}~${maxPrice.toLocaleString()}원`;
    }
    if (minPrice !== null) {
      return `${channelLabel} ${minPrice.toLocaleString()}원 이상`;
    }
    return `${channelLabel} ${maxPrice!.toLocaleString()}원 이하`;
  };

  return (
    <main className="recommend-shell">
      <div className="recommend-header">
        <SiteHeader activeMenu="recommend" />
      </div>
      <div className="container">
        {/* 상단 헤더 */}
        <header style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              marginBottom: '0.85rem',
            }}
          >
            <div>
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: 'var(--primary)',
                  backgroundColor: 'var(--primary-soft)',
                  padding: '0.22rem 0.65rem',
                  borderRadius: '999px',
                  marginBottom: '0.4rem',
                }}
              >
                CUSTOM BURGER FINDER & RANDOM ROULETTE
              </span>
              <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>
                🍔 취향 맞춤 햄버거 추천
              </h1>
              <p style={{ color: 'var(--muted)', fontSize: '0.92rem' }}>
                항목별 <strong>[자세히 보기 ▾]</strong>를 눌러 원하는 조건을
                선택하거나, 조건 안에서 <strong>랜덤 1개</strong>를 뽑아보세요!
              </p>
            </div>

            {/* 우측 상단: 조건 연동형 랜덤 뽑기 메인 버튼 */}
            <button
              type="button"
              disabled={items.length === 0 || loading}
              onClick={() => handleRandomDraw()}
              className="btn-random"
            >
              <span>🎲</span>
              <span>
                {hasAnyActiveFilter
                  ? `현재 조건(${items.length}개) 중 랜덤 1개 뽑기!`
                  : `전체 메뉴(${items.length}개) 중 100% 랜덤 뽑기!`}
              </span>
            </button>
          </div>

          {/* 빠른 예시 조건 프리셋 */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.45rem',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={() =>
                applyPreset({
                  include: ['chicken-patty'],
                  exclude: ['tomato'],
                  minP: 4500,
                  maxP: 6000,
                  maxCal: 900,
                  variant: 'SINGLE',
                })
              }
              className="chip"
              style={{
                borderColor: 'var(--primary)',
                backgroundColor: 'var(--primary-soft)',
                color: 'var(--primary)',
                fontWeight: 600,
              }}
            >
              🔥 예시: 치킨패티 + 토마토 빼고 + 4,500~6,000원 + 900kcal↓
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset({
                  include: ['beef-patty', 'cheese'],
                  exclude: ['tomato', 'pickle'],
                  minP: 5000,
                  maxP: 8000,
                  maxCal: 800,
                  variant: 'SINGLE',
                })
              }
              className="chip"
            >
              🥩 소고기+치즈 (5,000~8,000원, 토마토·피클 빼고)
            </button>
            <button
              type="button"
              onClick={() =>
                applyPreset({
                  include: [],
                  exclude: ['onion'],
                  minP: null,
                  maxP: 5000,
                  maxCal: 550,
                  variant: 'SINGLE',
                })
              }
              className="chip"
            >
              💸 5,000원 이하 가성비 (양파 빼고, 550kcal↓)
            </button>
            <button
              type="button"
              onClick={resetAllFilters}
              className="chip"
              style={{ color: 'var(--muted)' }}
            >
              ↺ 조건 전체 해제
            </button>
          </div>
        </header>

        <div className="layout-grid">
          {/* 좌측: 조건 선택 필터 패널 (모바일 친화적 아코디언 구조) */}
          <aside
            className="card"
            style={{ position: 'sticky', top: '1.25rem', padding: '1.15rem' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.9rem',
              }}
            >
              <h2 style={{ fontSize: '1.08rem', fontWeight: 800 }}>
                조건 필터 설정
              </h2>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                }}
              >
                <button
                  type="button"
                  onClick={toggleAllSections}
                  style={{
                    background: 'none',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '0.2rem 0.5rem',
                    color: 'var(--foreground)',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                  }}
                >
                  {isAllExpanded ? '전체 접기 ▴' : '전체 펼치기 ▾'}
                </button>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--muted)',
                    fontSize: '0.82rem',
                    textDecoration: 'underline',
                  }}
                >
                  초기화
                </button>
              </div>
            </div>

            {/* 검색창 + 단품/세트 기준 토글 (컴팩트 상단 고정) */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '0.45rem',
                marginBottom: '0.85rem',
              }}
            >
              <input
                type="text"
                placeholder="🔍 버거명·브랜드 검색 (예: 와퍼, 싸이)"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '0.52rem 0.75rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--background)',
                  color: 'var(--foreground)',
                  fontSize: '0.84rem',
                  fontWeight: 500,
                }}
              />
              <div style={{ display: 'flex', gap: '0.25rem' }}>
                {(['SINGLE', 'SET'] as const).map((type) => {
                  const active = variantType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setVariantType(type)}
                      style={{
                        padding: '0.5rem 0.65rem',
                        borderRadius: '10px',
                        border: `1px solid ${
                          active ? 'var(--primary)' : 'var(--border-color)'
                        }`,
                        backgroundColor: active
                          ? 'var(--primary)'
                          : 'transparent',
                        color: active ? '#fff' : 'var(--foreground)',
                        fontWeight: 700,
                        fontSize: '0.8rem',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {type === 'SINGLE' ? '단품' : '세트'}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 1. 브랜드 아코디언 */}
            <div
              className={`filter-section-box ${
                openSections.brand ? 'is-open' : ''
              }`}
            >
              <button
                type="button"
                className="filter-section-header"
                onClick={() => toggleSection('brand')}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.4rem',
                    }}
                  >
                    <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                      1. 브랜드
                    </span>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '0.08rem 0.4rem',
                        borderRadius: '999px',
                        backgroundColor: 'var(--include-soft)',
                        color: 'var(--include-color)',
                      }}
                    >
                      DB {metadata?.brands.length ?? 0}개
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--muted)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedBrands.length === 0
                      ? '전체 브랜드 선택됨'
                      : selectedBrands.map((b) => getBrandName(b)).join(', ')}
                  </div>
                </div>
                <span className="filter-toggle-badge">
                  {openSections.brand ? '접기 ▴' : '자세히 보기 ▾'}
                </span>
              </button>

              {openSections.brand && (
                <div className="filter-section-body">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      marginBottom: '0.45rem',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => fetchFiltersAndBrands()}
                      style={{
                        background: 'none',
                        border: '1px solid var(--border-color)',
                        borderRadius: '6px',
                        padding: '0.15rem 0.45rem',
                        fontSize: '0.72rem',
                        color: 'var(--muted)',
                      }}
                    >
                      ↻ Supabase DB 브랜드 동기화
                    </button>
                  </div>
                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.38rem' }}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedBrands([])}
                      className={`chip ${
                        selectedBrands.length === 0 ? 'chip-active-brand' : ''
                      }`}
                    >
                      전체
                    </button>
                    {metadata?.brands.map((brand) => {
                      const isSelected = selectedBrands.includes(brand.slug);
                      return (
                        <button
                          key={brand.id}
                          type="button"
                          onClick={() => toggleBrand(brand.slug)}
                          className={`chip ${
                            isSelected ? 'chip-active-brand' : ''
                          }`}
                        >
                          {brand.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 2. 꼭 들어갈 재료 (+ 포함) 아코디언 */}
            <div
              className={`filter-section-box ${
                openSections.include ? 'is-open' : ''
              }`}
            >
              <button
                type="button"
                className="filter-section-header"
                onClick={() => toggleSection('include')}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--include-color)',
                    }}
                  >
                    2. 꼭 들어갈 재료 (+ 포함)
                  </span>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color:
                        includeIngredients.length > 0
                          ? 'var(--include-color)'
                          : 'var(--muted)',
                      fontWeight: includeIngredients.length > 0 ? 600 : 400,
                    }}
                  >
                    {includeIngredients.length === 0
                      ? '선택 안 함 (전체)'
                      : includeIngredients
                          .map((s) => `✓ ${getIngredientName(s)}`)
                          .join(', ')}
                  </div>
                </div>
                <span className="filter-toggle-badge">
                  {openSections.include ? '접기 ▴' : '자세히 보기 ▾'}
                </span>
              </button>

              {openSections.include && (
                <div className="filter-section-body">
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.38rem',
                      paddingTop: '0.35rem',
                    }}
                  >
                    {metadata?.ingredients.map((ing) => {
                      const isIncluded = includeIngredients.includes(ing.slug);
                      return (
                        <button
                          key={`inc-${ing.id}`}
                          type="button"
                          onClick={() => toggleIncludeIngredient(ing.slug)}
                          className={`chip ${isIncluded ? 'chip-include' : ''}`}
                        >
                          {isIncluded ? '✓ ' : '+ '}
                          {ing.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 3. 뺄 재료 (🚫 OO 빼고) 아코디언 */}
            <div
              className={`filter-section-box ${
                openSections.exclude ? 'is-open' : ''
              }`}
            >
              <button
                type="button"
                className="filter-section-header"
                onClick={() => toggleSection('exclude')}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.88rem',
                      fontWeight: 700,
                      color: 'var(--exclude-color)',
                    }}
                  >
                    3. 뺄 재료 (🚫 OO 빼고)
                  </span>
                  <div
                    style={{
                      fontSize: '0.78rem',
                      color:
                        excludeIngredients.length > 0
                          ? 'var(--exclude-color)'
                          : 'var(--muted)',
                      fontWeight: excludeIngredients.length > 0 ? 600 : 400,
                    }}
                  >
                    {excludeIngredients.length === 0
                      ? '제외할 재료 없음'
                      : excludeIngredients
                          .map((s) => `🚫 ${getIngredientName(s)} 빼고`)
                          .join(', ')}
                  </div>
                </div>
                <span className="filter-toggle-badge">
                  {openSections.exclude ? '접기 ▴' : '자세히 보기 ▾'}
                </span>
              </button>

              {openSections.exclude && (
                <div className="filter-section-body">
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '0.38rem',
                      paddingTop: '0.35rem',
                    }}
                  >
                    {metadata?.ingredients.map((ing) => {
                      const isExcluded = excludeIngredients.includes(ing.slug);
                      return (
                        <button
                          key={`exc-${ing.id}`}
                          type="button"
                          onClick={() => toggleExcludeIngredient(ing.slug)}
                          className={`chip ${isExcluded ? 'chip-exclude' : ''}`}
                        >
                          {isExcluded ? '🚫 ' : '− '}
                          {ing.name}
                          {isExcluded ? ' 빼고' : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 4. 금액 범위 (최소 ~ 최대) 아코디언 */}
            <div
              className={`filter-section-box ${
                openSections.price ? 'is-open' : ''
              }`}
            >
              <button
                type="button"
                className="filter-section-header"
                onClick={() => toggleSection('price')}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                  }}
                >
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    4. 금액 범위 (최소 ~ 최대)
                  </span>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color:
                        minPrice !== null || maxPrice !== null
                          ? 'var(--primary)'
                          : 'var(--muted)',
                      fontWeight:
                        minPrice !== null || maxPrice !== null ? 700 : 400,
                    }}
                  >
                    💰 {formatPriceSummary()}
                  </span>
                </div>
                <span className="filter-toggle-badge">
                  {openSections.price ? '접기 ▴' : '자세히 보기 ▾'}
                </span>
              </button>

              {openSections.price && (
                <div className="filter-section-body">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      paddingTop: '0.35rem',
                      marginBottom: '0.5rem',
                    }}
                  >
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
                      기준 채널
                    </span>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {(['STORE', 'DELIVERY'] as const).map((ch) => {
                        const active = priceChannel === ch;
                        return (
                          <button
                            key={ch}
                            type="button"
                            onClick={() => setPriceChannel(ch)}
                            style={{
                              padding: '0.2rem 0.55rem',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              borderRadius: '6px',
                              border: `1px solid ${
                                active
                                  ? 'var(--primary)'
                                  : 'var(--border-color)'
                              }`,
                              backgroundColor: active
                                ? 'var(--primary-soft)'
                                : 'transparent',
                              color: active ? 'var(--primary)' : 'var(--muted)',
                            }}
                          >
                            {ch === 'STORE' ? '매장가' : '배달가'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto 1fr',
                      alignItems: 'center',
                      gap: '0.45rem',
                      marginBottom: '0.55rem',
                    }}
                  >
                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min={0}
                        max={30000}
                        step={100}
                        placeholder="최소 금액"
                        value={minPrice ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setMinPrice(raw === '' ? null : Number(raw));
                        }}
                        style={{
                          width: '100%',
                          padding: '0.48rem 1.7rem 0.48rem 0.6rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--background)',
                          color: 'var(--foreground)',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.75rem',
                          color: 'var(--muted)',
                        }}
                      >
                        원
                      </span>
                    </div>

                    <span style={{ color: 'var(--muted)', fontWeight: 700 }}>
                      ~
                    </span>

                    <div style={{ position: 'relative' }}>
                      <input
                        type="number"
                        min={0}
                        max={30000}
                        step={100}
                        placeholder="최대 금액"
                        value={maxPrice ?? ''}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setMaxPrice(raw === '' ? null : Number(raw));
                        }}
                        style={{
                          width: '100%',
                          padding: '0.48rem 1.7rem 0.48rem 0.6rem',
                          borderRadius: '8px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--background)',
                          color: 'var(--foreground)',
                          fontSize: '0.84rem',
                          fontWeight: 600,
                        }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          right: '0.5rem',
                          top: '50%',
                          transform: 'translateY(-50%)',
                          fontSize: '0.75rem',
                          color: 'var(--muted)',
                        }}
                      >
                        원
                      </span>
                    </div>
                  </div>

                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}
                  >
                    {[
                      { label: '전체 금액', min: null, max: null },
                      { label: '~ 5,000원', min: null, max: 5000 },
                      { label: '5,000 ~ 6,500원', min: 5000, max: 6500 },
                      { label: '6,500 ~ 8,500원', min: 6500, max: 8500 },
                      { label: '8,000원 ~', min: 8000, max: null },
                    ].map((range) => {
                      const isSelected =
                        minPrice === range.min && maxPrice === range.max;
                      return (
                        <button
                          key={range.label}
                          type="button"
                          onClick={() => {
                            setMinPrice(range.min);
                            setMaxPrice(range.max);
                          }}
                          className={`chip ${
                            isSelected ? 'chip-active-brand' : ''
                          }`}
                          style={{
                            fontSize: '0.75rem',
                            padding: '0.26rem 0.52rem',
                          }}
                        >
                          {range.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* 5. 최대 칼로리 제한 아코디언 */}
            <div
              className={`filter-section-box ${
                openSections.calories ? 'is-open' : ''
              }`}
            >
              <button
                type="button"
                className="filter-section-header"
                onClick={() => toggleSection('calories')}
              >
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem',
                  }}
                >
                  <span style={{ fontSize: '0.88rem', fontWeight: 700 }}>
                    5. 최대 칼로리 제한
                  </span>
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color:
                        maxCalories !== null
                          ? 'var(--primary)'
                          : 'var(--muted)',
                      fontWeight: maxCalories !== null ? 700 : 400,
                    }}
                  >
                    🔥{' '}
                    {maxCalories === null
                      ? '제한 없음'
                      : `${maxCalories.toLocaleString()} kcal 이하`}
                  </span>
                </div>
                <span className="filter-toggle-badge">
                  {openSections.calories ? '접기 ▴' : '자세히 보기 ▾'}
                </span>
              </button>

              {openSections.calories && (
                <div className="filter-section-body">
                  <input
                    type="range"
                    min={450}
                    max={1200}
                    step={50}
                    value={maxCalories ?? 1200}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setMaxCalories(val >= 1200 ? null : val);
                    }}
                    style={{
                      width: '100%',
                      accentColor: 'var(--primary)',
                      marginTop: '0.45rem',
                      marginBottom: '0.55rem',
                    }}
                  />

                  <div
                    style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}
                  >
                    {[500, 600, 750, 900, 1050].map((cal) => (
                      <button
                        key={cal}
                        type="button"
                        onClick={() => setMaxCalories(cal)}
                        className={`chip ${
                          maxCalories === cal ? 'chip-active-brand' : ''
                        }`}
                        style={{
                          fontSize: '0.76rem',
                          padding: '0.28rem 0.55rem',
                        }}
                      >
                        {cal}kcal 이하
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setMaxCalories(null)}
                      className={`chip ${
                        maxCalories === null ? 'chip-active-brand' : ''
                      }`}
                      style={{
                        fontSize: '0.76rem',
                        padding: '0.28rem 0.55rem',
                      }}
                    >
                      제한 없음
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 좌측 패널 하단: 1) 조건에 맞는 전체 메뉴 검색 버튼 + 2) 랜덤 1개 뽑기 버튼 */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.5rem',
                marginTop: '0.9rem',
              }}
            >
              <button
                type="button"
                onClick={() => fetchRecommendations()}
                style={{
                  width: '100%',
                  padding: '0.68rem 1rem',
                  borderRadius: '12px',
                  border: '1px solid var(--foreground)',
                  backgroundColor: 'var(--foreground)',
                  color: 'var(--background)',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                }}
              >
                🔍 조건에 맞는 전체 메뉴 조회 ({items.length}개)
              </button>
              <button
                type="button"
                disabled={items.length === 0 || loading}
                onClick={() => handleRandomDraw()}
                className="btn-random"
                style={{ width: '100%' }}
              >
                🎲 이 조건 중 1개만 랜덤 뽑기 ({items.length}개 후보)
              </button>
            </div>
          </aside>

          {/* 우측: 현재 선택된 조건 요약 바 + 추천 메뉴 리스트 */}
          <section>
            {/* 선택된 조건 요약 및 정렬 */}
            <div
              className="card"
              style={{
                marginBottom: '1.25rem',
                padding: '1rem 1.25rem',
                display: 'flex',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: '0.45rem',
                }}
              >
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>
                  적용된 조건:
                </span>
                <span
                  className="chip"
                  style={{ fontSize: '0.8rem', fontWeight: 600 }}
                >
                  {variantType === 'SINGLE' ? '단품 기준' : '세트 기준'}
                </span>

                {selectedBrands.map((b) => (
                  <span key={b} className="chip chip-active-brand">
                    {getBrandName(b)}
                  </span>
                ))}

                {includeIngredients.map((slug) => (
                  <span key={slug} className="chip chip-include">
                    ✓ {getIngredientName(slug)} 포함
                  </span>
                ))}

                {excludeIngredients.map((slug) => (
                  <span key={slug} className="chip chip-exclude">
                    🚫 {getIngredientName(slug)} 빼고
                  </span>
                ))}

                {(minPrice !== null || maxPrice !== null) && (
                  <span
                    className="chip"
                    style={{
                      borderColor: 'var(--primary)',
                      backgroundColor: 'var(--primary-soft)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    💰 {formatPriceSummary()}
                  </span>
                )}

                {maxCalories !== null && (
                  <span
                    className="chip"
                    style={{
                      borderColor: 'var(--primary)',
                      color: 'var(--primary)',
                      fontWeight: 600,
                    }}
                  >
                    🔥 {maxCalories}kcal 이하
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                  총{' '}
                  <strong style={{ color: 'var(--primary)' }}>
                    {items.length}
                  </strong>
                  개 메뉴
                </span>

                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  style={{
                    padding: '0.45rem 0.7rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--card-bg)',
                    color: 'var(--foreground)',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  <option value="calories_asc">칼로리 낮은 순</option>
                  <option value="calories_desc">칼로리 높은 순</option>
                  <option value="price_asc">금액 낮은 순</option>
                  <option value="price_desc">금액 높은 순</option>
                  <option value="protein_desc">단백질 높은 순</option>
                </select>
              </div>
            </div>

            {/* 에러 또는 로딩 표시 */}
            {error && (
              <div
                className="card"
                style={{
                  borderColor: 'var(--exclude-color)',
                  color: 'var(--exclude-color)',
                  marginBottom: '1rem',
                }}
              >
                ⚠️ {error}
              </div>
            )}

            {loading ? (
              <div
                className="card"
                style={{
                  textAlign: 'center',
                  padding: '3rem',
                  color: 'var(--muted)',
                }}
              >
                조건에 맞는 햄버거를 찾는 중입니다...
              </div>
            ) : items.length === 0 ? (
              <div
                className="card"
                style={{ textAlign: 'center', padding: '3.5rem 1.5rem' }}
              >
                <p
                  style={{
                    fontSize: '1.15rem',
                    fontWeight: 700,
                    marginBottom: '0.5rem',
                  }}
                >
                  선택하신 조건에 해당하는 햄버거가 없습니다 😢
                </p>
                <p
                  style={{
                    color: 'var(--muted)',
                    fontSize: '0.9rem',
                    marginBottom: '1.25rem',
                  }}
                >
                  최소~최대 금액 범위나 칼로리/재료 조건을 조금 완화해 보세요.
                </p>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="chip chip-active-brand"
                >
                  조건 초기화하기
                </button>
              </div>
            ) : (
              <div className="results-grid">
                {items.map((burger) => {
                  const activeVar = burger.activeVariant;
                  const otherVar = burger.variants.find(
                    (v) => v.variantType !== activeVar.variantType
                  );
                  const displayedPrice =
                    priceChannel === 'DELIVERY'
                      ? activeVar.prices.delivery
                      : activeVar.prices.store;

                  return (
                    <article
                      key={burger.id}
                      className="card"
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: '1rem',
                      }}
                    >
                      <div>
                        {/* 브랜드 배지 및 금액/칼로리 하이라이트 */}
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              padding: '0.2rem 0.6rem',
                              borderRadius: '6px',
                              backgroundColor: 'var(--primary-soft)',
                              color: 'var(--primary)',
                            }}
                          >
                            {burger.brand.name}
                          </span>
                          <span
                            style={{
                              fontSize: '0.95rem',
                              fontWeight: 800,
                              color: 'var(--primary)',
                            }}
                          >
                            {displayedPrice.toLocaleString()}원 ·{' '}
                            {activeVar.nutrition.caloriesKcal}kcal
                          </span>
                        </div>

                        {/* 버거 이름 & 설명 */}
                        <h3
                          style={{
                            fontSize: '1.2rem',
                            fontWeight: 800,
                            marginBottom: '0.35rem',
                          }}
                        >
                          {burger.name}
                        </h3>
                        <p
                          style={{
                            fontSize: '0.86rem',
                            color: 'var(--muted)',
                            marginBottom: '0.9rem',
                          }}
                        >
                          {burger.description}
                        </p>

                        {/* 들어있는 재료 태그 목록 */}
                        <div style={{ marginBottom: '0.9rem' }}>
                          <div
                            style={{
                              fontSize: '0.76rem',
                              fontWeight: 700,
                              color: 'var(--muted)',
                              marginBottom: '0.35rem',
                            }}
                          >
                            구성 재료
                          </div>
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              gap: '0.3rem',
                            }}
                          >
                            {burger.ingredients.map((ing) => {
                              const isMatchedInclude =
                                includeIngredients.includes(ing.slug);
                              return (
                                <span
                                  key={ing.id}
                                  style={{
                                    fontSize: '0.76rem',
                                    padding: '0.2rem 0.5rem',
                                    borderRadius: '6px',
                                    fontWeight: isMatchedInclude ? 700 : 500,
                                    backgroundColor: isMatchedInclude
                                      ? 'var(--include-soft)'
                                      : 'var(--background)',
                                    color: isMatchedInclude
                                      ? 'var(--include-color)'
                                      : 'var(--foreground)',
                                    border: `1px solid ${
                                      isMatchedInclude
                                        ? 'var(--include-color)'
                                        : 'var(--border-color)'
                                    }`,
                                  }}
                                >
                                  {isMatchedInclude ? '✓ ' : ''}
                                  {ing.name}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>

                      {/* 하단 가격(매장/배달) 및 영양성분 상세 */}
                      <div
                        style={{
                          borderTop: '1px solid var(--border-color)',
                          paddingTop: '0.85rem',
                          fontSize: '0.83rem',
                        }}
                      >
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            gap: '0.4rem',
                            textAlign: 'center',
                            backgroundColor: 'var(--background)',
                            padding: '0.55rem',
                            borderRadius: '10px',
                            marginBottom: '0.65rem',
                          }}
                        >
                          <div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                              }}
                            >
                              열량
                            </div>
                            <div style={{ fontWeight: 700 }}>
                              {activeVar.nutrition.caloriesKcal}kcal
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                              }}
                            >
                              단백질
                            </div>
                            <div style={{ fontWeight: 700 }}>
                              {activeVar.nutrition.proteinG}g
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                              }}
                            >
                              중량
                            </div>
                            <div style={{ fontWeight: 700 }}>
                              {activeVar.nutrition.servingSizeG}g
                            </div>
                          </div>
                          <div>
                            <div
                              style={{
                                fontSize: '0.72rem',
                                color: 'var(--muted)',
                              }}
                            >
                              나트륨
                            </div>
                            <div style={{ fontWeight: 700 }}>
                              {activeVar.nutrition.sodiumMg}mg
                            </div>
                          </div>
                        </div>

                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <div>
                            <span style={{ fontWeight: 700 }}>
                              {activeVar.name} 매장가{' '}
                              {activeVar.prices.store.toLocaleString()}원
                            </span>
                            <span
                              style={{
                                color: 'var(--muted)',
                                marginLeft: '0.4rem',
                                fontSize: '0.78rem',
                              }}
                            >
                              (배달 {activeVar.prices.delivery.toLocaleString()}
                              원)
                            </span>
                          </div>
                          {otherVar && (
                            <span
                              style={{
                                fontSize: '0.76rem',
                                color: 'var(--muted)',
                              }}
                            >
                              {otherVar.name}:{' '}
                              {otherVar.prices.store.toLocaleString()}원 (
                              {otherVar.nutrition.caloriesKcal}kcal)
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* 🎲 조건 연동형 랜덤 뽑기 결과 모달 */}
        {isRandomModalOpen && (
          <div
            className="modal-backdrop"
            onClick={() => !isRolling && setIsRandomModalOpen(false)}
          >
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              {isRolling ? (
                <div style={{ textAlign: 'center', padding: '2.5rem 1rem' }}>
                  <div style={{ fontSize: '2.6rem', marginBottom: '0.75rem' }}>
                    🎰
                  </div>
                  <p
                    style={{
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      color: 'var(--primary)',
                      marginBottom: '0.5rem',
                    }}
                  >
                    {hasAnyActiveFilter
                      ? `현재 조건에 맞는 ${items.length}개 후보 중에서 뽑는 중...`
                      : `전체 ${items.length}개 메뉴 중에서 랜덤 추첨 중...`}
                  </p>
                  <div
                    style={{
                      fontSize: '1.45rem',
                      fontWeight: 800,
                      padding: '0.9rem',
                      borderRadius: '12px',
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border-color)',
                    }}
                  >
                    {rollingPreviewName || '두구두구...'}
                  </div>
                </div>
              ) : randomPicked ? (
                <div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.85rem',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        padding: '0.28rem 0.75rem',
                        borderRadius: '999px',
                        backgroundColor: 'var(--primary-soft)',
                        color: 'var(--primary)',
                      }}
                    >
                      🎉 오늘의 추천 버거 당첨! (
                      {hasAnyActiveFilter
                        ? `조건 부합 ${randomTotalCandidates}개 중`
                        : `전체 ${randomTotalCandidates}개 중`}
                      )
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRandomModalOpen(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '1.2rem',
                        color: 'var(--muted)',
                      }}
                    >
                      ✕
                    </button>
                  </div>

                  <div
                    style={{
                      padding: '1.25rem',
                      borderRadius: '14px',
                      backgroundColor: 'var(--background)',
                      border: '1px solid var(--border-color)',
                      marginBottom: '1.25rem',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '0.4rem',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: 'var(--primary)',
                        }}
                      >
                        {randomPicked.brand.name}
                      </span>
                      <span style={{ fontSize: '0.95rem', fontWeight: 800 }}>
                        {(priceChannel === 'DELIVERY'
                          ? randomPicked.activeVariant.prices.delivery
                          : randomPicked.activeVariant.prices.store
                        ).toLocaleString()}
                        원 ·{' '}
                        {randomPicked.activeVariant.nutrition.caloriesKcal}
                        kcal
                      </span>
                    </div>

                    <h3
                      style={{
                        fontSize: '1.5rem',
                        fontWeight: 800,
                        marginBottom: '0.4rem',
                      }}
                    >
                      {randomPicked.name}
                    </h3>
                    <p
                      style={{
                        fontSize: '0.9rem',
                        color: 'var(--muted)',
                        marginBottom: '1rem',
                      }}
                    >
                      {randomPicked.description}
                    </p>

                    {/* 포함 재료 태그 */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '0.35rem',
                        marginBottom: '1rem',
                      }}
                    >
                      {randomPicked.ingredients.map((ing) => {
                        const isMatchedInclude = includeIngredients.includes(
                          ing.slug
                        );
                        return (
                          <span
                            key={ing.id}
                            style={{
                              fontSize: '0.78rem',
                              padding: '0.22rem 0.55rem',
                              borderRadius: '6px',
                              fontWeight: isMatchedInclude ? 700 : 500,
                              backgroundColor: isMatchedInclude
                                ? 'var(--include-soft)'
                                : 'var(--card-bg)',
                              color: isMatchedInclude
                                ? 'var(--include-color)'
                                : 'var(--foreground)',
                              border: `1px solid ${
                                isMatchedInclude
                                  ? 'var(--include-color)'
                                  : 'var(--border-color)'
                              }`,
                            }}
                          >
                            {isMatchedInclude ? '✓ ' : ''}
                            {ing.name}
                          </span>
                        );
                      })}
                    </div>

                    {/* 영양성분 및 단품/세트 가격 요약 */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(4, 1fr)',
                        gap: '0.4rem',
                        textAlign: 'center',
                        backgroundColor: 'var(--card-bg)',
                        padding: '0.6rem',
                        borderRadius: '10px',
                        fontSize: '0.82rem',
                      }}
                    >
                      <div>
                        <div
                          style={{ fontSize: '0.72rem', color: 'var(--muted)' }}
                        >
                          열량({randomPicked.activeVariant.name})
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {randomPicked.activeVariant.nutrition.caloriesKcal}
                          kcal
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: '0.72rem', color: 'var(--muted)' }}
                        >
                          단백질
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {randomPicked.activeVariant.nutrition.proteinG}g
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: '0.72rem', color: 'var(--muted)' }}
                        >
                          매장가
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {randomPicked.activeVariant.prices.store.toLocaleString()}
                          원
                        </div>
                      </div>
                      <div>
                        <div
                          style={{ fontSize: '0.72rem', color: 'var(--muted)' }}
                        >
                          배달가
                        </div>
                        <div style={{ fontWeight: 700 }}>
                          {randomPicked.activeVariant.prices.delivery.toLocaleString()}
                          원
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 하단 액션 버튼: 다시 뽑기 / 닫기 */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        randomTotalCandidates > 1 ? '1fr auto' : '1fr',
                      gap: '0.6rem',
                    }}
                  >
                    {randomTotalCandidates > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRandomDraw(randomPicked.id)}
                        className="btn-random"
                      >
                        🎲 다른 메뉴로 다시 뽑기 ({randomTotalCandidates - 1}개
                        남음)
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsRandomModalOpen(false)}
                      className="chip"
                      style={{
                        justifyContent: 'center',
                        padding: '0.68rem 1.2rem',
                        borderRadius: '12px',
                        fontWeight: 700,
                      }}
                    >
                      확인
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

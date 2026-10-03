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
  const channelLabel = priceChannel === 'DELIVERY' ? '배달가' : '매장가';

  return (
    // 랭킹·비교 화면과 동일하게 worldcup-shell 위에 recommend-shell 을 얹는다.
    <main className="worldcup-shell recommend-shell">
      <SiteHeader activeMenu="recommend" />

      <div className="rc-content">
        {/* 상단 헤더 */}
        <header className="rc-hero">
          <div className="rc-heading">
            <span className="eyebrow">BURGER PICK · BURGER FINDER</span>
            <h1>
              고민은 줄이고,
              <br />
              <strong>취향만 고르세요.</strong>
            </h1>
            <p>
              항목별 <b>자세히 보기</b>를 눌러 원하는 조건을 고르거나, 조건
              안에서 <b>랜덤 1개</b>를 뽑아보세요.
            </p>
          </div>

          {/* 조건 연동형 랜덤 뽑기 메인 버튼 */}
          <button
            type="button"
            disabled={items.length === 0 || loading}
            onClick={() => handleRandomDraw()}
            className="rc-random-button rc-random-hero"
          >
            <span>
              {hasAnyActiveFilter
                ? `현재 조건(${items.length}개) 중 랜덤 1개 뽑기`
                : `전체 메뉴(${items.length}개) 중 랜덤 뽑기`}
            </span>
            <b aria-hidden="true">🎲</b>
          </button>
        </header>

        {/* 빠른 예시 조건 프리셋 */}
        <div className="rc-presets" role="group" aria-label="빠른 조건 예시">
          <span className="rc-presets-label">빠른 예시</span>
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
            className="rc-chip rc-chip-accent"
          >
            🔥 치킨패티 + 토마토 빼고 + 4,500~6,000원 + 900kcal↓
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
            className="rc-chip"
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
            className="rc-chip"
          >
            💸 5,000원 이하 가성비 (양파 빼고, 550kcal↓)
          </button>
          <button
            type="button"
            onClick={resetAllFilters}
            className="rc-text-button"
          >
            ↺ 조건 전체 해제
          </button>
        </div>

        <div className="rc-layout">
          {/* 좌측: 조건 선택 필터 패널 (아코디언 구조) */}
          <aside className="rc-panel" aria-label="조건 필터">
            <div className="rc-panel-head">
              <h2>조건 필터</h2>
              <div className="rc-panel-actions">
                <button
                  type="button"
                  onClick={toggleAllSections}
                  className="rc-mini-button"
                >
                  {isAllExpanded ? '전체 접기 ▴' : '전체 펼치기 ▾'}
                </button>
                <button
                  type="button"
                  onClick={resetAllFilters}
                  className="rc-text-button"
                >
                  초기화
                </button>
              </div>
            </div>

            {/* 검색창 + 단품/세트 기준 토글 */}
            <div className="rc-search-row">
              <label className="rc-search">
                <span aria-hidden="true">🔍</span>
                <input
                  type="search"
                  aria-label="버거명·브랜드 검색"
                  placeholder="버거명·브랜드 (예: 와퍼, 싸이)"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                />
              </label>
              <div className="rc-segment" role="group" aria-label="판매 형태">
                {(['SINGLE', 'SET'] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={variantType === type}
                    className={variantType === type ? 'selected' : ''}
                    onClick={() => setVariantType(type)}
                  >
                    {type === 'SINGLE' ? '단품' : '세트'}
                  </button>
                ))}
              </div>
            </div>

            {/* 1. 브랜드 */}
            <FilterSection
              title="1. 브랜드"
              badge={`DB ${metadata?.brands.length ?? 0}개`}
              summary={
                selectedBrands.length === 0
                  ? '전체 브랜드 선택됨'
                  : selectedBrands.map((b) => getBrandName(b)).join(', ')
              }
              active={selectedBrands.length > 0}
              isOpen={openSections.brand}
              onToggle={() => toggleSection('brand')}
            >
              <div className="rc-section-tools">
                <button
                  type="button"
                  onClick={() => fetchFiltersAndBrands()}
                  className="rc-mini-button"
                >
                  ↻ Supabase DB 브랜드 동기화
                </button>
              </div>
              <div className="rc-chip-group">
                <button
                  type="button"
                  onClick={() => setSelectedBrands([])}
                  className={`rc-chip ${
                    selectedBrands.length === 0 ? 'selected' : ''
                  }`}
                >
                  전체
                </button>
                {metadata?.brands.map((brand) => (
                  <button
                    key={brand.id}
                    type="button"
                    onClick={() => toggleBrand(brand.slug)}
                    className={`rc-chip ${
                      selectedBrands.includes(brand.slug) ? 'selected' : ''
                    }`}
                  >
                    {brand.name}
                  </button>
                ))}
              </div>
            </FilterSection>

            {/* 2. 꼭 들어갈 재료 */}
            <FilterSection
              title="2. 꼭 들어갈 재료 (+ 포함)"
              tone="include"
              summary={
                includeIngredients.length === 0
                  ? '선택 안 함 (전체)'
                  : includeIngredients
                      .map((s) => `✓ ${getIngredientName(s)}`)
                      .join(', ')
              }
              active={includeIngredients.length > 0}
              isOpen={openSections.include}
              onToggle={() => toggleSection('include')}
            >
              <div className="rc-chip-group">
                {metadata?.ingredients.map((ing) => {
                  const isIncluded = includeIngredients.includes(ing.slug);
                  return (
                    <button
                      key={`inc-${ing.id}`}
                      type="button"
                      onClick={() => toggleIncludeIngredient(ing.slug)}
                      className={`rc-chip ${isIncluded ? 'rc-chip-include' : ''}`}
                    >
                      {isIncluded ? '✓ ' : '+ '}
                      {ing.name}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* 3. 뺄 재료 */}
            <FilterSection
              title="3. 뺄 재료 (🚫 OO 빼고)"
              tone="exclude"
              summary={
                excludeIngredients.length === 0
                  ? '제외할 재료 없음'
                  : excludeIngredients
                      .map((s) => `🚫 ${getIngredientName(s)} 빼고`)
                      .join(', ')
              }
              active={excludeIngredients.length > 0}
              isOpen={openSections.exclude}
              onToggle={() => toggleSection('exclude')}
            >
              <div className="rc-chip-group">
                {metadata?.ingredients.map((ing) => {
                  const isExcluded = excludeIngredients.includes(ing.slug);
                  return (
                    <button
                      key={`exc-${ing.id}`}
                      type="button"
                      onClick={() => toggleExcludeIngredient(ing.slug)}
                      className={`rc-chip ${isExcluded ? 'rc-chip-exclude' : ''}`}
                    >
                      {isExcluded ? '🚫 ' : '− '}
                      {ing.name}
                      {isExcluded ? ' 빼고' : ''}
                    </button>
                  );
                })}
              </div>
            </FilterSection>

            {/* 4. 금액 범위 */}
            <FilterSection
              title="4. 금액 범위 (최소 ~ 최대)"
              summary={`💰 ${formatPriceSummary()}`}
              active={minPrice !== null || maxPrice !== null}
              isOpen={openSections.price}
              onToggle={() => toggleSection('price')}
            >
              <div className="rc-field-row">
                <span>기준 채널</span>
                <div
                  className="rc-segment rc-segment-sm"
                  role="group"
                  aria-label="가격 기준 채널"
                >
                  {(['STORE', 'DELIVERY'] as const).map((ch) => (
                    <button
                      key={ch}
                      type="button"
                      aria-pressed={priceChannel === ch}
                      className={priceChannel === ch ? 'selected' : ''}
                      onClick={() => setPriceChannel(ch)}
                    >
                      {ch === 'STORE' ? '매장가' : '배달가'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rc-price-inputs">
                <label className="rc-input-wrap">
                  <input
                    type="number"
                    min={0}
                    max={30000}
                    step={100}
                    aria-label="최소 금액"
                    placeholder="최소 금액"
                    value={minPrice ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setMinPrice(raw === '' ? null : Number(raw));
                    }}
                  />
                  <span aria-hidden="true">원</span>
                </label>
                <span className="rc-range-sep" aria-hidden="true">
                  ~
                </span>
                <label className="rc-input-wrap">
                  <input
                    type="number"
                    min={0}
                    max={30000}
                    step={100}
                    aria-label="최대 금액"
                    placeholder="최대 금액"
                    value={maxPrice ?? ''}
                    onChange={(e) => {
                      const raw = e.target.value;
                      setMaxPrice(raw === '' ? null : Number(raw));
                    }}
                  />
                  <span aria-hidden="true">원</span>
                </label>
              </div>

              <div className="rc-chip-group">
                {[
                  { label: '전체 금액', min: null, max: null },
                  { label: '~ 5,000원', min: null, max: 5000 },
                  { label: '5,000 ~ 6,500원', min: 5000, max: 6500 },
                  { label: '6,500 ~ 8,500원', min: 6500, max: 8500 },
                  { label: '8,000원 ~', min: 8000, max: null },
                ].map((range) => (
                  <button
                    key={range.label}
                    type="button"
                    onClick={() => {
                      setMinPrice(range.min);
                      setMaxPrice(range.max);
                    }}
                    className={`rc-chip rc-chip-sm ${
                      minPrice === range.min && maxPrice === range.max
                        ? 'selected'
                        : ''
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </FilterSection>

            {/* 5. 최대 칼로리 제한 */}
            <FilterSection
              title="5. 최대 칼로리 제한"
              summary={`🔥 ${
                maxCalories === null
                  ? '제한 없음'
                  : `${maxCalories.toLocaleString()} kcal 이하`
              }`}
              active={maxCalories !== null}
              isOpen={openSections.calories}
              onToggle={() => toggleSection('calories')}
            >
              <input
                type="range"
                className="rc-range"
                aria-label="최대 칼로리"
                min={450}
                max={1200}
                step={50}
                value={maxCalories ?? 1200}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxCalories(val >= 1200 ? null : val);
                }}
              />
              <div className="rc-chip-group">
                {[500, 600, 750, 900, 1050].map((cal) => (
                  <button
                    key={cal}
                    type="button"
                    onClick={() => setMaxCalories(cal)}
                    className={`rc-chip rc-chip-sm ${
                      maxCalories === cal ? 'selected' : ''
                    }`}
                  >
                    {cal}kcal 이하
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setMaxCalories(null)}
                  className={`rc-chip rc-chip-sm ${
                    maxCalories === null ? 'selected' : ''
                  }`}
                >
                  제한 없음
                </button>
              </div>
            </FilterSection>

            {/* 패널 하단: 전체 메뉴 조회 + 랜덤 1개 뽑기 */}
            <div className="rc-panel-cta">
              <button
                type="button"
                onClick={() => fetchRecommendations()}
                className="rc-outline-button"
              >
                <span>조건에 맞는 전체 메뉴 조회 ({items.length}개)</span>
                <b aria-hidden="true">→</b>
              </button>
              <button
                type="button"
                disabled={items.length === 0 || loading}
                onClick={() => handleRandomDraw()}
                className="rc-random-button"
              >
                <span>이 조건 중 1개만 랜덤 뽑기 ({items.length}개 후보)</span>
                <b aria-hidden="true">🎲</b>
              </button>
            </div>
          </aside>

          {/* 우측: 선택된 조건 요약 + 추천 메뉴 리스트 */}
          <section className="rc-results" aria-label="추천 결과">
            <div className="rc-summary">
              <span className="rc-summary-label">적용된 조건</span>
              <span className="rc-tag">
                {variantType === 'SINGLE' ? '단품 기준' : '세트 기준'}
              </span>
              {selectedBrands.map((b) => (
                <span key={b} className="rc-tag rc-tag-ink">
                  {getBrandName(b)}
                </span>
              ))}
              {includeIngredients.map((slug) => (
                <span key={slug} className="rc-tag rc-tag-include">
                  ✓ {getIngredientName(slug)} 포함
                </span>
              ))}
              {excludeIngredients.map((slug) => (
                <span key={slug} className="rc-tag rc-tag-exclude">
                  🚫 {getIngredientName(slug)} 빼고
                </span>
              ))}
              {(minPrice !== null || maxPrice !== null) && (
                <span className="rc-tag rc-tag-accent">
                  💰 {formatPriceSummary()}
                </span>
              )}
              {maxCalories !== null && (
                <span className="rc-tag rc-tag-accent">
                  🔥 {maxCalories}kcal 이하
                </span>
              )}
            </div>

            <div className="rc-list-header">
              <p className="rc-count" aria-live="polite">
                햄버거 <strong>{items.length}</strong>개
              </p>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rc-select"
                aria-label="정렬 기준"
              >
                <option value="calories_asc">칼로리 낮은 순</option>
                <option value="calories_desc">칼로리 높은 순</option>
                <option value="price_asc">금액 낮은 순</option>
                <option value="price_desc">금액 높은 순</option>
                <option value="protein_desc">단백질 높은 순</option>
              </select>
            </div>

            {/* 에러 또는 로딩 표시 */}
            {error && (
              <div className="rc-error" role="alert">
                <strong>오류</strong>
                <span>{error}</span>
              </div>
            )}

            {loading ? (
              <div className="rc-state">조건에 맞는 햄버거를 찾는 중입니다...</div>
            ) : items.length === 0 ? (
              <div className="rc-empty">
                <h3>선택하신 조건에 해당하는 햄버거가 없습니다.</h3>
                <p>최소~최대 금액 범위나 칼로리/재료 조건을 조금 완화해 보세요.</p>
                <button type="button" onClick={resetAllFilters}>
                  조건 초기화하기
                </button>
              </div>
            ) : (
              <div className="rc-grid">
                {items.map((burger) => {
                  const activeVar = burger.activeVariant;
                  const otherVar = burger.variants.find(
                    (v) => v.variantType !== activeVar.variantType
                  );
                  const displayedPrice =
                    priceChannel === 'DELIVERY'
                      ? activeVar.prices.delivery
                      : activeVar.prices.store;
                  const otherChannelPrice =
                    priceChannel === 'DELIVERY'
                      ? activeVar.prices.store
                      : activeVar.prices.delivery;

                  return (
                    <article key={burger.id} className="rc-card">
                      <div className="rc-card-body">
                        <small className="rc-card-brand">{burger.brand.name}</small>
                        <h3 className="rc-card-name">{burger.name}</h3>
                        <p className="rc-card-desc">{burger.description}</p>

                        {/* 들어있는 재료 태그 목록 */}
                        <div className="rc-ingredients" aria-label="구성 재료">
                          {burger.ingredients.map((ing) => {
                            const isMatched = includeIngredients.includes(ing.slug);
                            return (
                              <span
                                key={ing.id}
                                className={`rc-ingredient ${
                                  isMatched ? 'is-matched' : ''
                                }`}
                              >
                                {isMatched ? '✓ ' : ''}
                                {ing.name}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      {/* 가격(매장/배달) 및 영양성분 */}
                      <div className="rc-card-foot">
                        <dl className="rc-prices">
                          <div className="rc-price-row">
                            <dt>
                              {activeVar.name} {channelLabel}
                            </dt>
                            <dd className="rc-price-main">
                              {displayedPrice.toLocaleString()}원
                            </dd>
                          </div>
                          <div className="rc-price-row">
                            <dt>
                              {priceChannel === 'DELIVERY' ? '매장가' : '배달가'}
                            </dt>
                            <dd>{otherChannelPrice.toLocaleString()}원</dd>
                          </div>
                          {otherVar && (
                            <div className="rc-price-row">
                              <dt>{otherVar.name} 매장가</dt>
                              <dd>
                                {otherVar.prices.store.toLocaleString()}원 ·{' '}
                                {otherVar.nutrition.caloriesKcal}kcal
                              </dd>
                            </div>
                          )}
                        </dl>

                        <dl className="rc-nutrition">
                          <div>
                            <dt>열량</dt>
                            <dd>{activeVar.nutrition.caloriesKcal}kcal</dd>
                          </div>
                          <div>
                            <dt>단백질</dt>
                            <dd>{activeVar.nutrition.proteinG}g</dd>
                          </div>
                          <div>
                            <dt>중량</dt>
                            <dd>{activeVar.nutrition.servingSizeG}g</dd>
                          </div>
                          <div>
                            <dt>나트륨</dt>
                            <dd>{activeVar.nutrition.sodiumMg}mg</dd>
                          </div>
                        </dl>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>

      {/* 조건 연동형 랜덤 뽑기 결과 모달 */}
      {isRandomModalOpen && (
        <div
          className="rc-modal-backdrop"
          onClick={() => !isRolling && setIsRandomModalOpen(false)}
        >
          <div
            className="rc-modal"
            role="dialog"
            aria-modal="true"
            aria-label="랜덤 추천 결과"
            onClick={(e) => e.stopPropagation()}
          >
            {isRolling ? (
              <div className="rc-rolling" aria-live="polite">
                <span className="winner-label">RANDOM PICK</span>
                <p>
                  {hasAnyActiveFilter
                    ? `현재 조건에 맞는 ${items.length}개 후보 중에서 뽑는 중...`
                    : `전체 ${items.length}개 메뉴 중에서 랜덤 추첨 중...`}
                </p>
                <div className="rc-rolling-name">
                  {rollingPreviewName || '두구두구...'}
                </div>
              </div>
            ) : randomPicked ? (
              <div>
                <div className="rc-modal-head">
                  <span className="winner-label">TODAY&apos;S PICK</span>
                  <button
                    type="button"
                    onClick={() => setIsRandomModalOpen(false)}
                    className="rc-modal-close"
                    aria-label="닫기"
                  >
                    ✕
                  </button>
                </div>
                <p className="rc-modal-caption">
                  오늘의 추천 버거 당첨!{' '}
                  {hasAnyActiveFilter
                    ? `조건 부합 ${randomTotalCandidates}개 중`
                    : `전체 ${randomTotalCandidates}개 중`}
                </p>

                <div className="rc-modal-visual" aria-hidden="true">
                  <span className="crown">♛</span>
                  <b>🍔</b>
                </div>

                <div className="rc-modal-copy">
                  <small className="rc-card-brand">{randomPicked.brand.name}</small>
                  <h3 className="rc-modal-name">{randomPicked.name}</h3>
                  <p className="rc-card-desc">{randomPicked.description}</p>
                  <p className="rc-modal-price">
                    <strong>
                      {(priceChannel === 'DELIVERY'
                        ? randomPicked.activeVariant.prices.delivery
                        : randomPicked.activeVariant.prices.store
                      ).toLocaleString()}
                      원
                    </strong>
                    <span>
                      {randomPicked.activeVariant.name} {channelLabel} ·{' '}
                      {randomPicked.activeVariant.nutrition.caloriesKcal}kcal
                    </span>
                  </p>

                  <div className="rc-ingredients" aria-label="구성 재료">
                    {randomPicked.ingredients.map((ing) => {
                      const isMatched = includeIngredients.includes(ing.slug);
                      return (
                        <span
                          key={ing.id}
                          className={`rc-ingredient ${isMatched ? 'is-matched' : ''}`}
                        >
                          {isMatched ? '✓ ' : ''}
                          {ing.name}
                        </span>
                      );
                    })}
                  </div>

                  <dl className="rc-nutrition">
                    <div>
                      <dt>열량({randomPicked.activeVariant.name})</dt>
                      <dd>{randomPicked.activeVariant.nutrition.caloriesKcal}kcal</dd>
                    </div>
                    <div>
                      <dt>단백질</dt>
                      <dd>{randomPicked.activeVariant.nutrition.proteinG}g</dd>
                    </div>
                    <div>
                      <dt>매장가</dt>
                      <dd>
                        {randomPicked.activeVariant.prices.store.toLocaleString()}원
                      </dd>
                    </div>
                    <div>
                      <dt>배달가</dt>
                      <dd>
                        {randomPicked.activeVariant.prices.delivery.toLocaleString()}원
                      </dd>
                    </div>
                  </dl>
                </div>

                {/* 하단 액션 버튼: 다시 뽑기 / 확인 */}
                <div className="rc-modal-actions">
                  {randomTotalCandidates > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRandomDraw(randomPicked.id)}
                      className="rc-random-button"
                    >
                      <span>다른 메뉴로 다시 뽑기 ({randomTotalCandidates - 1}개 남음)</span>
                      <b aria-hidden="true">↻</b>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsRandomModalOpen(false)}
                    className="reset-button"
                  >
                    확인
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      <footer className="site-footer">
        <span>© 2026 BURGER PICK</span>
        <span>가격은 매장과 시점에 따라 다를 수 있습니다.</span>
      </footer>
    </main>
  );
}

function FilterSection({
  title,
  badge,
  summary,
  active,
  tone,
  isOpen,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  summary: string;
  active: boolean;
  tone?: 'include' | 'exclude';
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const toneClass = tone ? `tone-${tone}` : '';
  return (
    <div className={`rc-section ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="rc-section-header"
        aria-expanded={isOpen}
        onClick={onToggle}
      >
        <span className="rc-section-copy">
          <span className={`rc-section-title ${toneClass}`}>
            {title}
            {badge && <small className="rc-count-badge">{badge}</small>}
          </span>
          <span
            className={`rc-section-summary ${toneClass} ${
              active ? 'is-active' : ''
            }`}
          >
            {summary}
          </span>
        </span>
        <span className="rc-toggle-badge">
          {isOpen ? '접기 ▴' : '자세히 보기 ▾'}
        </span>
      </button>
      {isOpen && <div className="rc-section-body">{children}</div>}
    </div>
  );
}

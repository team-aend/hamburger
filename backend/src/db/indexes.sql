-- ============================================================================
-- Hamburger Service Recommended Indexes (PostgreSQL / Supabase)
-- 주의: PostgreSQL은 PRIMARY KEY와 UNIQUE 제약조건에는 자동으로 인덱스를 생성하지만,
--       FOREIGN KEY(외래키)와 일반 WHERE/ORDER BY 컬럼에는 자동 생성하지 않습니다.
-- ============================================================================

-- 0. 한글/부분 문자열(ILIKE '%와퍼%') 고속 검색을 위한 pg_trgm 확장 활성화
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- 1. products 테이블
-- ============================================================================
-- [목록/필터용] 활성 상태(status='ACTIVE')이면서 카테고리/브랜드별로 필터링할 때 사용
CREATE INDEX IF NOT EXISTS idx_products_status_category_brand
    ON products (status, category_id, brand_id);

-- [브랜드별 조회용] 특정 브랜드의 메뉴만 모아볼 때 사용 (FK 인덱스)
CREATE INDEX IF NOT EXISTS idx_products_brand_id
    ON products (brand_id);

-- [이름 검색용] 메뉴명 중간 글자 검색(예: WHERE name ILIKE '%치즈%') 고속 처리용 GIN 인덱스
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
    ON products USING gin (name gin_trgm_ops);


-- ============================================================================
-- 2. product_variants 테이블
-- ============================================================================
-- [조인/판매형태 필터용] 상품(product_id)과 단품(SINGLE)/세트(SET) 조건으로 조인할 때 필수
CREATE INDEX IF NOT EXISTS idx_product_variants_product_type_active
    ON product_variants (product_id, variant_type)
    WHERE is_active = TRUE;


-- ============================================================================
-- 3. product_prices 테이블
-- ============================================================================
-- [금액 범위 검색 & 가격순 정렬용]
-- 현재 유효한 가격(ended_at IS NULL) 중에서 매장가(STORE)/배달가(DELIVERY) 최소~최대 금액 비교용
CREATE INDEX IF NOT EXISTS idx_product_prices_active_channel_price
    ON product_prices (channel, price, product_variant_id)
    WHERE ended_at IS NULL;

-- [가격 변동 이력 조회용] 특정 메뉴의 과거~현재 가격 인상 타임라인 조회용
CREATE INDEX IF NOT EXISTS idx_product_prices_history
    ON product_prices (product_variant_id, channel, started_at DESC);


-- ============================================================================
-- 4. nutrition 테이블
-- ============================================================================
-- [칼로리 조건 & 정렬용] WHERE calories_kcal <= 900 및 칼로리 낮은/높은 순 정렬용
CREATE INDEX IF NOT EXISTS idx_nutrition_calories
    ON nutrition (calories_kcal ASC, product_variant_id);

-- [단백질 정렬용] 단백질 높은 순(ORDER BY protein_g DESC) 정렬용
CREATE INDEX IF NOT EXISTS idx_nutrition_protein
    ON nutrition (protein_g DESC, product_variant_id);


-- ============================================================================
-- 5. product_ingredients & product_tags (다대다 매핑 역방향 조회 — 매우 중요!)
-- ============================================================================
-- PK가 (product_id, ingredient_id) 순서이므로,
-- 반대로 "특정 재료(치킨패티, 토마토)가 들어간 버거(product_id) 찾기"를 할 때는
-- 반드시 (ingredient_id, product_id) 순서의 역방향 인덱스가 있어야 Full Scan을 피할 수 있습니다.
CREATE INDEX IF NOT EXISTS idx_product_ingredients_ing_prod
    ON product_ingredients (ingredient_id, product_id);

-- 특정 태그(#매콤, #고단백)가 붙은 버거 목록을 찾을 때 사용하는 역방향 인덱스
CREATE INDEX IF NOT EXISTS idx_product_tags_tag_prod
    ON product_tags (tag_id, product_id);

-- 재료 그룹(PATTY, TOPPING, CHEESE_SAUCE)별 필터 목록 조회용
CREATE INDEX IF NOT EXISTS idx_ingredients_group
    ON ingredients (ingredient_group);

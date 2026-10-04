-- ============================================================================
-- 버거 한 줄 평 (리뷰 및 별점 평가)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_reviews (
    id                  BIGSERIAL PRIMARY KEY,
    product_id          BIGINT NOT NULL,
    user_id             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    author_name         VARCHAR(100) NOT NULL,
    rating              SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    content             VARCHAR(200) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product_created
    ON product_reviews (product_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_reviews_user_id
    ON product_reviews (user_id);

-- 초기 시드 리뷰 (기존 리뷰가 없는 경우에만 삽입)
INSERT INTO product_reviews (product_id, author_name, rating, content, created_at)
SELECT 1, '버거박사', 5, '클래식한 특제 소스와 두툼한 더블 패티의 조화가 역시 근본입니다! 🍔', NOW() - INTERVAL '2 days'
WHERE NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = 1);

INSERT INTO product_reviews (product_id, author_name, rating, content, created_at)
SELECT 1, '헬스러버', 4, '단백질 27g 든든하게 챙기기 딱 좋아요. 단성비도 훌륭합니다.', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = 1 AND author_name = '헬스러버');

INSERT INTO product_reviews (product_id, author_name, rating, content, created_at)
SELECT 4, '불맛매니아', 5, '직화 패티 향이 제대로 느껴집니다. 크기도 커서 하나만 먹어도 든든해요.', NOW() - INTERVAL '3 days'
WHERE NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = 4);

INSERT INTO product_reviews (product_id, author_name, rating, content, created_at)
SELECT 4, '치즈러버', 4, '치즈 한 장 추가해서 먹으면 불맛과 치즈 조화가 최고예요!', NOW() - INTERVAL '12 hours'
WHERE NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = 4 AND author_name = '치즈러버');

INSERT INTO product_reviews (product_id, author_name, rating, content, created_at)
SELECT 13, '치킨버거원탑', 5, '바삭하고 육즙 가득한 통다리살 패티... 가성비와 맛 모두 압도적입니다.', NOW() - INTERVAL '1 day'
WHERE NOT EXISTS (SELECT 1 FROM product_reviews WHERE product_id = 13);

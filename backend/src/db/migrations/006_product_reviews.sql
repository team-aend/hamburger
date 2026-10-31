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

-- ============================================================================
-- 상품 좋아요 (로그인 사용자 1인 1회)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_likes (
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id          BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, product_id)
);

-- 상품별 좋아요 수 집계용 (PK 가 user_id 선두라 product_id 로 찾으려면 역방향 인덱스가 필요)
CREATE INDEX IF NOT EXISTS idx_product_likes_product_id
    ON product_likes (product_id);

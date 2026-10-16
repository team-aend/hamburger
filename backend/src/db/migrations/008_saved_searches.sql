-- ============================================================================
-- 저장한 검색 조건 (검색·추천 화면의 "내 조건")
-- filters 는 검증된 조건만 저장한다 (backend/src/savedSearches/domain/savedSearch.ts)
-- ============================================================================

CREATE TABLE IF NOT EXISTS saved_searches (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name                VARCHAR(30) NOT NULL,
    filters             JSONB NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_created
    ON saved_searches (user_id, created_at DESC);

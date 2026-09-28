-- ============================================================================
-- 소셜 로그인 사용자 테이블
-- users           : 서비스 회원 1명 = 1행
-- user_identities : 소셜 계정 연결 (현재 GOOGLE, 추후 KAKAO / NAVER 추가 가능)
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id                  BIGSERIAL PRIMARY KEY,
    email               VARCHAR(255),
    display_name        VARCHAR(100) NOT NULL,
    avatar_url          TEXT,
    last_login_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_identities (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider            VARCHAR(30) NOT NULL,                  -- GOOGLE
    provider_user_id    VARCHAR(255) NOT NULL,                 -- Google 'sub'
    email               VARCHAR(255),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (provider, provider_user_id)
);

CREATE INDEX IF NOT EXISTS idx_user_identities_user_id
    ON user_identities (user_id);

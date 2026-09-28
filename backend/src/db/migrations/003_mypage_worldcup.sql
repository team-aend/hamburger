-- ============================================================================
-- 마이페이지 / 월드컵 기록
-- ============================================================================

-- 닉네임: 구글 이름(display_name)은 로그인할 때마다 갱신되므로 별도 컬럼으로 둔다.
-- NULL 이면 구글 이름을 그대로 쓴다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname VARCHAR(20);

-- 월드컵 1회 = 1행. burger id 는 프론트 data/burgers.ts 의 id (예: 'classic-cheese')
-- 회원 탈퇴 시 user_id 만 NULL 로 바꿔 개인정보 없이 랭킹 통계에만 남긴다.
CREATE TABLE IF NOT EXISTS worldcup_results (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT REFERENCES users(id) ON DELETE SET NULL,
    round_size          SMALLINT NOT NULL CHECK (round_size IN (8, 16)),
    winner_burger_id    VARCHAR(50) NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_worldcup_results_user_created
    ON worldcup_results (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_worldcup_results_winner
    ON worldcup_results (winner_burger_id);

-- 월드컵 안의 개별 대결 (대결 승률 집계용). round_size: 16, 8, 4, 2(결승)
CREATE TABLE IF NOT EXISTS worldcup_matches (
    id                  BIGSERIAL PRIMARY KEY,
    result_id           BIGINT NOT NULL REFERENCES worldcup_results(id) ON DELETE CASCADE,
    round_size          SMALLINT NOT NULL,
    winner_burger_id    VARCHAR(50) NOT NULL,
    loser_burger_id     VARCHAR(50) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_worldcup_matches_result
    ON worldcup_matches (result_id);

-- Server-owned worldcup sessions. Legacy worldcup_results/worldcup_matches remain separate.
CREATE TABLE IF NOT EXISTS worldcup_sessions (
    id UUID PRIMARY KEY,
    owner_token_hash TEXT NOT NULL,
    round_size SMALLINT NOT NULL CHECK (round_size IN (8, 16)),
    status TEXT NOT NULL DEFAULT 'IN_PROGRESS'
        CHECK (status IN ('IN_PROGRESS', 'COMPLETED', 'ABANDONED', 'EXPIRED')),
    winner_product_id BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    abandoned_at TIMESTAMPTZ,
    CHECK (expires_at > created_at),
    CHECK ((status = 'COMPLETED') = (winner_product_id IS NOT NULL)),
    CHECK ((status = 'COMPLETED') = (completed_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_worldcup_sessions_owner_created
    ON worldcup_sessions (owner_token_hash, created_at DESC);

CREATE TABLE IF NOT EXISTS worldcup_entries (
    session_id UUID NOT NULL REFERENCES worldcup_sessions(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    position SMALLINT NOT NULL CHECK (position >= 0 AND position < 16),
    name TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    PRIMARY KEY (session_id, product_id),
    UNIQUE (session_id, position)
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'fk_worldcup_session_winner_entry'
          AND conrelid = 'worldcup_sessions'::regclass
    ) THEN
        ALTER TABLE worldcup_sessions ADD CONSTRAINT fk_worldcup_session_winner_entry
            FOREIGN KEY (id, winner_product_id)
            REFERENCES worldcup_entries(session_id, product_id);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS worldcup_session_matches (
    id UUID PRIMARY KEY,
    session_id UUID NOT NULL REFERENCES worldcup_sessions(id) ON DELETE CASCADE,
    round_size SMALLINT NOT NULL CHECK (round_size IN (2, 4, 8, 16)),
    match_index SMALLINT NOT NULL CHECK (match_index >= 0 AND match_index < round_size / 2),
    left_product_id BIGINT NOT NULL,
    right_product_id BIGINT NOT NULL,
    winner_product_id BIGINT,
    decided_at TIMESTAMPTZ,
    UNIQUE (session_id, round_size, match_index),
    FOREIGN KEY (session_id, left_product_id) REFERENCES worldcup_entries(session_id, product_id),
    FOREIGN KEY (session_id, right_product_id) REFERENCES worldcup_entries(session_id, product_id),
    FOREIGN KEY (session_id, winner_product_id) REFERENCES worldcup_entries(session_id, product_id),
    CHECK (left_product_id <> right_product_id),
    CHECK (winner_product_id IS NULL OR winner_product_id IN (left_product_id, right_product_id)),
    CHECK ((winner_product_id IS NULL) = (decided_at IS NULL))
);

CREATE TABLE IF NOT EXISTS worldcup_creation_requests (
    request_key UUID PRIMARY KEY,
    owner_token_hash TEXT NOT NULL,
    request_body_hash TEXT NOT NULL,
    session_id UUID REFERENCES worldcup_sessions(id) ON DELETE RESTRICT,
    initial_response JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    retry_expires_at TIMESTAMPTZ NOT NULL,
    CHECK (retry_expires_at > created_at),
    CHECK ((session_id IS NULL) = (initial_response IS NULL))
);

CREATE INDEX IF NOT EXISTS idx_worldcup_creation_requests_expiry
    ON worldcup_creation_requests (retry_expires_at);

-- Only backend PostgreSQL connections access anonymous owner hashes and session data.
-- No policies are granted to Supabase anon/authenticated clients.
ALTER TABLE worldcup_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE worldcup_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE worldcup_session_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE worldcup_creation_requests ENABLE ROW LEVEL SECURITY;

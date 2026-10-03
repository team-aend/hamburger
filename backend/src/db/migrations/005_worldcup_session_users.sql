-- Only authenticated creation attaches a session to a member. Legacy sample
-- results are retained in their old tables and are never converted to products.
ALTER TABLE worldcup_sessions ADD COLUMN IF NOT EXISTS user_id BIGINT
    REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_worldcup_sessions_user_completed
    ON worldcup_sessions (user_id, completed_at DESC) WHERE status = 'COMPLETED';

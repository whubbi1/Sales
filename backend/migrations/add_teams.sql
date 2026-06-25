ALTER TABLE tickets ADD COLUMN IF NOT EXISTS teams_chat_id TEXT;
CREATE TABLE IF NOT EXISTS teams_subscriptions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id       UUID REFERENCES tickets(id) ON DELETE CASCADE,
    chat_id         TEXT NOT NULL,
    subscription_id TEXT,
    expires_at      TIMESTAMP,
    created_at      TIMESTAMP DEFAULT NOW(),
    CONSTRAINT uq_teams_chat UNIQUE (chat_id)
);

-- EscapezCore ownership: staff_chat_logs (MC staffchat audit trail).
CREATE TABLE IF NOT EXISTS staff_chat_logs (
    id           BIGSERIAL PRIMARY KEY,
    sender_uuid  UUID NOT NULL,
    sender_name  VARCHAR(16) NOT NULL,
    message      TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_chat_logs_created
    ON staff_chat_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_chat_logs_sender
    ON staff_chat_logs (sender_uuid);

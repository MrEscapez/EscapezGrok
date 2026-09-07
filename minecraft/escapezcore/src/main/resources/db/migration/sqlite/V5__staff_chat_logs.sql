CREATE TABLE IF NOT EXISTS staff_chat_logs (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_uuid  TEXT NOT NULL,
    sender_name  TEXT NOT NULL,
    message      TEXT NOT NULL,
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_staff_chat_logs_created
    ON staff_chat_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_chat_logs_sender
    ON staff_chat_logs (sender_uuid);

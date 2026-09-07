-- EscapezCore ownership: command_cooldowns (optional persistence; UUID identity).
CREATE TABLE IF NOT EXISTS command_cooldowns (
    player_uuid  UUID NOT NULL,
    command_id   VARCHAR(64) NOT NULL,
    expires_at   TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (player_uuid, command_id)
);

CREATE INDEX IF NOT EXISTS idx_command_cooldowns_expires
    ON command_cooldowns (expires_at);

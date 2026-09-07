CREATE TABLE IF NOT EXISTS command_cooldowns (
    player_uuid  TEXT NOT NULL,
    command_id   TEXT NOT NULL,
    expires_at   TEXT NOT NULL,
    PRIMARY KEY (player_uuid, command_id)
);

CREATE INDEX IF NOT EXISTS idx_command_cooldowns_expires
    ON command_cooldowns (expires_at);

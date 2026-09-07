CREATE TABLE IF NOT EXISTS minecraft_players (
    uuid        TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    first_seen  TEXT NOT NULL,
    last_seen   TEXT NOT NULL,
    last_ip     TEXT,
    updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_minecraft_players_name
    ON minecraft_players (name);

CREATE INDEX IF NOT EXISTS idx_minecraft_players_last_seen
    ON minecraft_players (last_seen DESC);

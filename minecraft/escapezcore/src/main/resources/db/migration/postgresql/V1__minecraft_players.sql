-- EscapezCore ownership: minecraft_players (UUID PK). Staff Panel must NOT own this table.
CREATE TABLE IF NOT EXISTS minecraft_players (
    uuid        UUID PRIMARY KEY,
    name        VARCHAR(16) NOT NULL,
    first_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_ip     VARCHAR(64),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_minecraft_players_name
    ON minecraft_players (LOWER(name));

CREATE INDEX IF NOT EXISTS idx_minecraft_players_last_seen
    ON minecraft_players (last_seen DESC);

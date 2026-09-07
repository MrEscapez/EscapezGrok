-- EscapezCore ownership: player_preferences (UUID identity).
CREATE TABLE IF NOT EXISTS player_preferences (
    player_uuid  UUID NOT NULL,
    pref_key     VARCHAR(64) NOT NULL,
    pref_value   TEXT,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (player_uuid, pref_key)
);

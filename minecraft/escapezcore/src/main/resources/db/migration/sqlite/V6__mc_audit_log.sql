CREATE TABLE IF NOT EXISTS mc_audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_uuid   TEXT,
    actor_name   TEXT,
    action       TEXT NOT NULL,
    target_uuid  TEXT,
    details      TEXT,
    created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mc_audit_log_created
    ON mc_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_audit_log_actor
    ON mc_audit_log (actor_uuid);

CREATE INDEX IF NOT EXISTS idx_mc_audit_log_action
    ON mc_audit_log (action);

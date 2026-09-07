-- EscapezCore ownership: mc_audit_log skeleton (MC-side audit only — not Staff Panel web audit).
CREATE TABLE IF NOT EXISTS mc_audit_log (
    id           BIGSERIAL PRIMARY KEY,
    actor_uuid   UUID,
    actor_name   VARCHAR(16),
    action       VARCHAR(64) NOT NULL,
    target_uuid  UUID,
    details      TEXT,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mc_audit_log_created
    ON mc_audit_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_audit_log_actor
    ON mc_audit_log (actor_uuid);

CREATE INDEX IF NOT EXISTS idx_mc_audit_log_action
    ON mc_audit_log (action);

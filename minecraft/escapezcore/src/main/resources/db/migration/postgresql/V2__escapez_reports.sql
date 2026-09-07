-- EscapezCore ownership: escapez_reports (FASE 5+). Aligns with existing CREATE TABLE IF NOT EXISTS.
-- Do NOT create Staff Panel tickets/appeals tables here.
CREATE TABLE IF NOT EXISTS escapez_reports (
    id               BIGSERIAL PRIMARY KEY,
    reporter_uuid    UUID NOT NULL,
    reporter_name    VARCHAR(16) NOT NULL,
    target_uuid      UUID NOT NULL,
    target_name      VARCHAR(16) NOT NULL,
    reason           TEXT NOT NULL,
    status           VARCHAR(32) NOT NULL,
    staff_notes      TEXT,
    claimed_by_uuid  UUID,
    claimed_by_name  VARCHAR(16),
    created_at       TIMESTAMPTZ NOT NULL,
    updated_at       TIMESTAMPTZ NOT NULL,
    resolved_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_status
    ON escapez_reports (status);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_created
    ON escapez_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_reporter
    ON escapez_reports (reporter_uuid);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_target
    ON escapez_reports (target_uuid);

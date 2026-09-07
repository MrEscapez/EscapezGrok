CREATE TABLE IF NOT EXISTS escapez_reports (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    reporter_uuid    TEXT NOT NULL,
    reporter_name    TEXT NOT NULL,
    target_uuid      TEXT NOT NULL,
    target_name      TEXT NOT NULL,
    reason           TEXT NOT NULL,
    status           TEXT NOT NULL,
    staff_notes      TEXT,
    claimed_by_uuid  TEXT,
    claimed_by_name  TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL,
    resolved_at      TEXT
);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_status
    ON escapez_reports (status);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_created
    ON escapez_reports (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_reporter
    ON escapez_reports (reporter_uuid);

CREATE INDEX IF NOT EXISTS idx_escapez_reports_target
    ON escapez_reports (target_uuid);

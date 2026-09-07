package be.escapezcraft.escapezcore.report;

import java.util.Locale;

/**
 * Lifecycle statuses for a player report.
 */
public enum ReportStatus {
    OPEN,
    IN_PROGRESS,
    RESOLVED,
    DISMISSED;

    public static ReportStatus fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return OPEN;
        }
        return ReportStatus.valueOf(raw.trim().toUpperCase(Locale.ROOT));
    }

    public String displayDutch() {
        return switch (this) {
            case OPEN -> "Open";
            case IN_PROGRESS -> "In behandeling";
            case RESOLVED -> "Opgelost";
            case DISMISSED -> "Afgewezen";
        };
    }
}

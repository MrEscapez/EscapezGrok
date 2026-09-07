package be.escapezcraft.escapezcore.report;

import java.time.Instant;
import java.util.Objects;
import java.util.UUID;

/**
 * Immutable snapshot of a player report. Identity uses UUIDs; names are display-only.
 */
public final class Report {

    private final long id;
    private final UUID reporterUuid;
    private final String reporterName;
    private final UUID targetUuid;
    private final String targetName;
    private final String reason;
    private final ReportStatus status;
    private final String staffNotes;
    private final UUID claimedByUuid;
    private final String claimedByName;
    private final Instant createdAt;
    private final Instant updatedAt;
    private final Instant resolvedAt;

    public Report(
            long id,
            UUID reporterUuid,
            String reporterName,
            UUID targetUuid,
            String targetName,
            String reason,
            ReportStatus status,
            String staffNotes,
            UUID claimedByUuid,
            String claimedByName,
            Instant createdAt,
            Instant updatedAt,
            Instant resolvedAt
    ) {
        this.id = id;
        this.reporterUuid = Objects.requireNonNull(reporterUuid, "reporterUuid");
        this.reporterName = reporterName == null ? "?" : reporterName;
        this.targetUuid = Objects.requireNonNull(targetUuid, "targetUuid");
        this.targetName = targetName == null ? "?" : targetName;
        this.reason = reason == null ? "" : reason;
        this.status = status == null ? ReportStatus.OPEN : status;
        this.staffNotes = staffNotes;
        this.claimedByUuid = claimedByUuid;
        this.claimedByName = claimedByName;
        this.createdAt = createdAt == null ? Instant.EPOCH : createdAt;
        this.updatedAt = updatedAt == null ? this.createdAt : updatedAt;
        this.resolvedAt = resolvedAt;
    }

    public long id() {
        return id;
    }

    public UUID reporterUuid() {
        return reporterUuid;
    }

    public String reporterName() {
        return reporterName;
    }

    public UUID targetUuid() {
        return targetUuid;
    }

    public String targetName() {
        return targetName;
    }

    public String reason() {
        return reason;
    }

    public ReportStatus status() {
        return status;
    }

    public String staffNotes() {
        return staffNotes;
    }

    public UUID claimedByUuid() {
        return claimedByUuid;
    }

    public String claimedByName() {
        return claimedByName;
    }

    public Instant createdAt() {
        return createdAt;
    }

    public Instant updatedAt() {
        return updatedAt;
    }

    public Instant resolvedAt() {
        return resolvedAt;
    }

    public Report withStatus(ReportStatus newStatus, Instant when) {
        Instant resolved = (newStatus == ReportStatus.RESOLVED || newStatus == ReportStatus.DISMISSED)
                ? when : resolvedAt;
        return new Report(id, reporterUuid, reporterName, targetUuid, targetName, reason,
                newStatus, staffNotes, claimedByUuid, claimedByName, createdAt, when, resolved);
    }

    public Report withClaim(UUID staffUuid, String staffName, Instant when) {
        return new Report(id, reporterUuid, reporterName, targetUuid, targetName, reason,
                ReportStatus.IN_PROGRESS, staffNotes, staffUuid, staffName, createdAt, when, resolvedAt);
    }

    public Report withStaffNotes(String notes, Instant when) {
        return new Report(id, reporterUuid, reporterName, targetUuid, targetName, reason,
                status, notes, claimedByUuid, claimedByName, createdAt, when, resolvedAt);
    }
}

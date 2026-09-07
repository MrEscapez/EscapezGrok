package be.escapezcraft.escapezcore.database;

import be.escapezcraft.escapezcore.EscapezCorePlugin;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

/**
 * Skeleton writer for EscapezCore-owned {@code mc_audit_log} (MC-side only).
 */
public final class McAuditRepository {

    private final EscapezCorePlugin plugin;
    private final DatabaseModule database;
    private final DatabaseDialect dialect;

    public McAuditRepository(EscapezCorePlugin plugin, DatabaseModule database, DatabaseDialect dialect) {
        this.plugin = plugin;
        this.database = database;
        this.dialect = dialect;
    }

    public CompletableFuture<Void> record(
            UUID actorUuid,
            String actorName,
            String action,
            UUID targetUuid,
            String details
    ) {
        Instant now = Instant.now();
        String act = action == null ? "unknown" : truncate(action, 64);
        return database.supplyAsync(connection -> {
            try {
                if (dialect == DatabaseDialect.POSTGRESQL) {
                    String sql = """
                            INSERT INTO mc_audit_log (actor_uuid, actor_name, action, target_uuid, details, created_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        if (actorUuid == null) {
                            ps.setObject(1, null);
                        } else {
                            ps.setObject(1, actorUuid);
                        }
                        if (actorName == null) {
                            ps.setNull(2, Types.VARCHAR);
                        } else {
                            ps.setString(2, truncate(actorName, 16));
                        }
                        ps.setString(3, act);
                        if (targetUuid == null) {
                            ps.setObject(4, null);
                        } else {
                            ps.setObject(4, targetUuid);
                        }
                        if (details == null) {
                            ps.setNull(5, Types.VARCHAR);
                        } else {
                            ps.setString(5, details);
                        }
                        ps.setTimestamp(6, Timestamp.from(now));
                        ps.executeUpdate();
                    }
                } else {
                    String sql = """
                            INSERT INTO mc_audit_log (actor_uuid, actor_name, action, target_uuid, details, created_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        ps.setString(1, actorUuid == null ? null : actorUuid.toString());
                        ps.setString(2, actorName == null ? null : truncate(actorName, 16));
                        ps.setString(3, act);
                        ps.setString(4, targetUuid == null ? null : targetUuid.toString());
                        ps.setString(5, details);
                        ps.setString(6, now.toString());
                        ps.executeUpdate();
                    }
                }
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "mc_audit_log insert mislukt: " + ex.getMessage());
                throw new RuntimeException(ex);
            }
            return null;
        });
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "?";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}

package be.escapezcraft.escapezcore.database;

import be.escapezcraft.escapezcore.EscapezCorePlugin;

import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

/**
 * Append-only writer for EscapezCore-owned {@code staff_chat_logs}.
 */
public final class StaffChatLogRepository {

    private final EscapezCorePlugin plugin;
    private final DatabaseModule database;
    private final DatabaseDialect dialect;

    public StaffChatLogRepository(EscapezCorePlugin plugin, DatabaseModule database, DatabaseDialect dialect) {
        this.plugin = plugin;
        this.database = database;
        this.dialect = dialect;
    }

    public CompletableFuture<Void> append(UUID senderUuid, String senderName, String message) {
        Instant now = Instant.now();
        String name = truncate(senderName, 16);
        String msg = message == null ? "" : message;
        return database.supplyAsync(connection -> {
            try {
                if (dialect == DatabaseDialect.POSTGRESQL) {
                    String sql = """
                            INSERT INTO staff_chat_logs (sender_uuid, sender_name, message, created_at)
                            VALUES (?, ?, ?, ?)
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        ps.setObject(1, senderUuid);
                        ps.setString(2, name);
                        ps.setString(3, msg);
                        ps.setTimestamp(4, Timestamp.from(now));
                        ps.executeUpdate();
                    }
                } else {
                    String sql = """
                            INSERT INTO staff_chat_logs (sender_uuid, sender_name, message, created_at)
                            VALUES (?, ?, ?, ?)
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        ps.setString(1, senderUuid.toString());
                        ps.setString(2, name);
                        ps.setString(3, msg);
                        ps.setString(4, now.toString());
                        ps.executeUpdate();
                    }
                }
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "staff_chat_logs insert mislukt: " + ex.getMessage());
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

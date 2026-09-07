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
 * Upserts into EscapezCore-owned {@code minecraft_players} (UUID primary key).
 */
public final class MinecraftPlayerRepository {

    private final EscapezCorePlugin plugin;
    private final DatabaseModule database;
    private final DatabaseDialect dialect;

    public MinecraftPlayerRepository(EscapezCorePlugin plugin, DatabaseModule database, DatabaseDialect dialect) {
        this.plugin = plugin;
        this.database = database;
        this.dialect = dialect;
    }

    public CompletableFuture<Void> upsertSeen(UUID uuid, String name, String lastIp) {
        Instant now = Instant.now();
        String n = truncate(name, 16);
        return database.supplyAsync(connection -> {
            try {
                if (dialect == DatabaseDialect.POSTGRESQL) {
                    String sql = """
                            INSERT INTO minecraft_players (uuid, name, first_seen, last_seen, last_ip, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT (uuid) DO UPDATE SET
                              name = EXCLUDED.name,
                              last_seen = EXCLUDED.last_seen,
                              last_ip = COALESCE(EXCLUDED.last_ip, minecraft_players.last_ip),
                              updated_at = EXCLUDED.updated_at
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        ps.setObject(1, uuid);
                        ps.setString(2, n);
                        ps.setTimestamp(3, Timestamp.from(now));
                        ps.setTimestamp(4, Timestamp.from(now));
                        if (lastIp == null || lastIp.isBlank()) {
                            ps.setNull(5, Types.VARCHAR);
                        } else {
                            ps.setString(5, truncate(lastIp, 64));
                        }
                        ps.setTimestamp(6, Timestamp.from(now));
                        ps.executeUpdate();
                    }
                } else {
                    String sql = """
                            INSERT INTO minecraft_players (uuid, name, first_seen, last_seen, last_ip, updated_at)
                            VALUES (?, ?, ?, ?, ?, ?)
                            ON CONFLICT(uuid) DO UPDATE SET
                              name = excluded.name,
                              last_seen = excluded.last_seen,
                              last_ip = COALESCE(excluded.last_ip, minecraft_players.last_ip),
                              updated_at = excluded.updated_at
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        String nowIso = now.toString();
                        ps.setString(1, uuid.toString());
                        ps.setString(2, n);
                        ps.setString(3, nowIso);
                        ps.setString(4, nowIso);
                        if (lastIp == null || lastIp.isBlank()) {
                            ps.setNull(5, Types.VARCHAR);
                        } else {
                            ps.setString(5, truncate(lastIp, 64));
                        }
                        ps.setString(6, nowIso);
                        ps.executeUpdate();
                    }
                }
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "minecraft_players upsert mislukt: " + ex.getMessage());
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

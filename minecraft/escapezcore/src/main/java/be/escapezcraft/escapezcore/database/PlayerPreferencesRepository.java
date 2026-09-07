package be.escapezcraft.escapezcore.database;

import be.escapezcraft.escapezcore.EscapezCorePlugin;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.logging.Level;

/**
 * Async read/write for EscapezCore-owned {@code player_preferences} (UUID + key).
 */
public final class PlayerPreferencesRepository {

    private final EscapezCorePlugin plugin;
    private final DatabaseModule database;
    private final DatabaseDialect dialect;

    public PlayerPreferencesRepository(EscapezCorePlugin plugin, DatabaseModule database, DatabaseDialect dialect) {
        this.plugin = plugin;
        this.database = database;
        this.dialect = dialect;
    }

    public CompletableFuture<Optional<String>> get(UUID uuid, String key) {
        String prefKey = truncate(key, 64);
        return database.supplyAsync(connection -> {
            try {
                String sql = "SELECT pref_value FROM player_preferences WHERE player_uuid = ? AND pref_key = ?";
                try (PreparedStatement ps = connection.prepareStatement(sql)) {
                    bindUuid(ps, 1, uuid);
                    ps.setString(2, prefKey);
                    try (ResultSet rs = ps.executeQuery()) {
                        if (rs.next()) {
                            return Optional.ofNullable(rs.getString(1));
                        }
                    }
                }
                return Optional.<String>empty();
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "player_preferences get mislukt: " + ex.getMessage());
                throw new RuntimeException(ex);
            }
        });
    }

    public CompletableFuture<Void> set(UUID uuid, String key, String value) {
        Instant now = Instant.now();
        String prefKey = truncate(key, 64);
        String prefValue = value;
        return database.supplyAsync(connection -> {
            try {
                if (dialect == DatabaseDialect.POSTGRESQL) {
                    String sql = """
                            INSERT INTO player_preferences (player_uuid, pref_key, pref_value, updated_at)
                            VALUES (?, ?, ?, ?)
                            ON CONFLICT (player_uuid, pref_key) DO UPDATE SET
                              pref_value = EXCLUDED.pref_value,
                              updated_at = EXCLUDED.updated_at
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        ps.setObject(1, uuid);
                        ps.setString(2, prefKey);
                        ps.setString(3, prefValue);
                        ps.setTimestamp(4, Timestamp.from(now));
                        ps.executeUpdate();
                    }
                } else {
                    String sql = """
                            INSERT INTO player_preferences (player_uuid, pref_key, pref_value, updated_at)
                            VALUES (?, ?, ?, ?)
                            ON CONFLICT(player_uuid, pref_key) DO UPDATE SET
                              pref_value = excluded.pref_value,
                              updated_at = excluded.updated_at
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        ps.setString(1, uuid.toString());
                        ps.setString(2, prefKey);
                        ps.setString(3, prefValue);
                        ps.setString(4, now.toString());
                        ps.executeUpdate();
                    }
                }
                return null;
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "player_preferences set mislukt: " + ex.getMessage());
                throw new RuntimeException(ex);
            }
        });
    }

    private void bindUuid(PreparedStatement ps, int index, UUID uuid) throws Exception {
        if (dialect == DatabaseDialect.POSTGRESQL) {
            ps.setObject(index, uuid);
        } else {
            ps.setString(index, uuid.toString());
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }
}

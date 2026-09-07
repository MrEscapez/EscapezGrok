package be.escapezcraft.escapezcore.database;

import org.bukkit.configuration.file.FileConfiguration;

/**
 * Resolved database settings. Secrets prefer environment variables; never log passwords.
 *
 * <ul>
 *   <li>{@code ESCAPEZ_DB_PASSWORD} — password (preferred)</li>
 *   <li>{@code ESCAPEZ_DB_USER} — username override</li>
 *   <li>{@code ESCAPEZ_DB_URL} — JDBC URL override</li>
 * </ul>
 */
public final class DatabaseSettings {

    public static final String ENV_PASSWORD = "ESCAPEZ_DB_PASSWORD";
    public static final String ENV_USER = "ESCAPEZ_DB_USER";
    public static final String ENV_URL = "ESCAPEZ_DB_URL";

    private final boolean enabled;
    private final DatabaseDialect dialect;
    private final String jdbcUrl;
    private final String username;
    private final String password;
    private final String poolName;
    private final int maximumPoolSize;
    private final int minimumIdle;
    private final long connectionTimeoutMs;
    private final long idleTimeoutMs;
    private final long maxLifetimeMs;
    private final long leakDetectionThresholdMs;
    private final String sqliteFile;

    private DatabaseSettings(
            boolean enabled,
            DatabaseDialect dialect,
            String jdbcUrl,
            String username,
            String password,
            String poolName,
            int maximumPoolSize,
            int minimumIdle,
            long connectionTimeoutMs,
            long idleTimeoutMs,
            long maxLifetimeMs,
            long leakDetectionThresholdMs,
            String sqliteFile
    ) {
        this.enabled = enabled;
        this.dialect = dialect;
        this.jdbcUrl = jdbcUrl;
        this.username = username;
        this.password = password;
        this.poolName = poolName;
        this.maximumPoolSize = maximumPoolSize;
        this.minimumIdle = minimumIdle;
        this.connectionTimeoutMs = connectionTimeoutMs;
        this.idleTimeoutMs = idleTimeoutMs;
        this.maxLifetimeMs = maxLifetimeMs;
        this.leakDetectionThresholdMs = leakDetectionThresholdMs;
        this.sqliteFile = sqliteFile;
    }

    public static DatabaseSettings fromConfig(FileConfiguration cfg) {
        boolean enabled = cfg.getBoolean("database.enabled", false);
        DatabaseDialect dialect = DatabaseDialect.fromConfig(cfg.getString("database.type", "postgresql"));

        String envUrl = getenv(ENV_URL);
        String jdbcUrl = (envUrl != null && !envUrl.isBlank())
                ? envUrl
                : cfg.getString("database.jdbc-url", "jdbc:postgresql://127.0.0.1:5432/escapezcraft");

        String envUser = getenv(ENV_USER);
        String username = (envUser != null && !envUser.isBlank())
                ? envUser
                : cfg.getString("database.username", "escapez");

        String envPassword = getenv(ENV_PASSWORD);
        String password = (envPassword != null)
                ? envPassword
                : cfg.getString("database.password", "");

        // Back-compat: pool-size at root, prefer nested pool.maximum-pool-size
        int maxPool = cfg.getInt("database.pool.maximum-pool-size",
                cfg.getInt("database.pool-size", 10));
        int minIdle = cfg.getInt("database.pool.minimum-idle", Math.min(2, maxPool));
        long connectionTimeout = cfg.getLong("database.pool.connection-timeout-ms", 10_000L);
        long idleTimeout = cfg.getLong("database.pool.idle-timeout-ms", 600_000L);
        long maxLifetime = cfg.getLong("database.pool.max-lifetime-ms", 1_800_000L);
        long leakDetection = cfg.getLong("database.pool.leak-detection-threshold-ms", 0L);
        String poolName = cfg.getString("database.pool.name", "EscapezCore-Hikari");
        String sqliteFile = cfg.getString("database.sqlite-file", "escapezcore.db");

        return new DatabaseSettings(
                enabled,
                dialect,
                jdbcUrl,
                username,
                password == null ? "" : password,
                poolName == null ? "EscapezCore-Hikari" : poolName,
                Math.max(1, maxPool),
                Math.max(0, minIdle),
                Math.max(1_000L, connectionTimeout),
                Math.max(0L, idleTimeout),
                Math.max(0L, maxLifetime),
                Math.max(0L, leakDetection),
                sqliteFile == null || sqliteFile.isBlank() ? "escapezcore.db" : sqliteFile
        );
    }

    private static String getenv(String key) {
        try {
            return System.getenv(key);
        } catch (SecurityException ignored) {
            return null;
        }
    }

    public boolean enabled() {
        return enabled;
    }

    public DatabaseDialect dialect() {
        return dialect;
    }

    public String jdbcUrl() {
        return jdbcUrl;
    }

    public String username() {
        return username;
    }

    /** Never log this value. */
    public String password() {
        return password;
    }

    public boolean passwordFromEnv() {
        String env = getenv(ENV_PASSWORD);
        return env != null;
    }

    public String poolName() {
        return poolName;
    }

    public int maximumPoolSize() {
        return maximumPoolSize;
    }

    public int minimumIdle() {
        return minimumIdle;
    }

    public long connectionTimeoutMs() {
        return connectionTimeoutMs;
    }

    public long idleTimeoutMs() {
        return idleTimeoutMs;
    }

    public long maxLifetimeMs() {
        return maxLifetimeMs;
    }

    public long leakDetectionThresholdMs() {
        return leakDetectionThresholdMs;
    }

    public String sqliteFile() {
        return sqliteFile;
    }

    /** Safe summary for logs — never includes password. */
    public String safeSummary() {
        return "type=" + dialect.name().toLowerCase()
                + ", url=" + jdbcUrl
                + ", user=" + username
                + ", password=" + (password.isEmpty() ? "(empty)" : (passwordFromEnv() ? "(env)" : "(config)"))
                + ", pool=" + poolName
                + ", maxPool=" + maximumPoolSize;
    }
}

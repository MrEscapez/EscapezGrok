package be.escapezcraft.escapezcore.api;

import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;

/**
 * Resolved Staff Panel bridge settings. Secrets prefer environment variables; never log them.
 *
 * <ul>
 *   <li>{@code ESCAPEZ_API_KEY} — shared bridge API key (preferred; aligns with Staff Panel BRIDGE_API_KEY)</li>
 *   <li>{@code ESCAPEZ_HMAC_SECRET} — optional HMAC secret</li>
 * </ul>
 */
public final class ApiSettings {

    public static final String ENV_API_KEY = "ESCAPEZ_API_KEY";
    public static final String ENV_HMAC_SECRET = "ESCAPEZ_HMAC_SECRET";

    private final boolean enabled;
    private final String baseUrl;
    private final String serverId;
    private final int heartbeatIntervalSeconds;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;
    private final boolean listenEnabled;
    private final String listenBind;
    private final int listenPort;
    private final String apiKey;
    private final boolean hmacEnabled;
    private final String hmacSecret;
    private final int pendingQueueMax;

    private ApiSettings(
            boolean enabled,
            String baseUrl,
            String serverId,
            int heartbeatIntervalSeconds,
            int connectTimeoutMs,
            int readTimeoutMs,
            boolean listenEnabled,
            String listenBind,
            int listenPort,
            String apiKey,
            boolean hmacEnabled,
            String hmacSecret,
            int pendingQueueMax
    ) {
        this.enabled = enabled;
        this.baseUrl = baseUrl;
        this.serverId = serverId;
        this.heartbeatIntervalSeconds = heartbeatIntervalSeconds;
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
        this.listenEnabled = listenEnabled;
        this.listenBind = listenBind;
        this.listenPort = listenPort;
        this.apiKey = apiKey;
        this.hmacEnabled = hmacEnabled;
        this.hmacSecret = hmacSecret;
        this.pendingQueueMax = pendingQueueMax;
    }

    public static ApiSettings fromConfig(FileConfiguration cfg) {
        ConfigurationSection api = cfg.getConfigurationSection("api");
        boolean enabled = api != null && api.getBoolean("enabled", false);
        String baseUrl = api != null
                ? api.getString("base-url", "http://127.0.0.1:3000/api/v1")
                : "http://127.0.0.1:3000/api/v1";
        if (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }
        String serverId = api != null ? api.getString("server-id", "survival-1") : "survival-1";
        int heartbeat = api != null ? api.getInt("heartbeat-interval-seconds", 30) : 30;
        int connectTimeout = api != null ? api.getInt("connect-timeout-ms", 3000) : 3000;
        int readTimeout = api != null ? api.getInt("read-timeout-ms", 5000) : 5000;
        int pendingMax = api != null ? api.getInt("pending-queue-max", 100) : 100;

        ConfigurationSection listen = api != null ? api.getConfigurationSection("listen") : null;
        boolean listenEnabled = listen != null && listen.getBoolean("enabled", true);
        String bind = listen != null ? listen.getString("bind", "127.0.0.1") : "127.0.0.1";
        int port = listen != null ? listen.getInt("port", 8765) : 8765;

        ConfigurationSection auth = api != null ? api.getConfigurationSection("auth") : null;
        String envKey = getenv(ENV_API_KEY);
        String cfgKey = auth != null ? auth.getString("api-key", "") : "";
        String apiKey = (envKey != null && !envKey.isBlank()) ? envKey : (cfgKey == null ? "" : cfgKey);

        boolean hmacEnabled = auth != null && auth.getBoolean("hmac-enabled", false);
        String envHmac = getenv(ENV_HMAC_SECRET);
        String cfgHmac = auth != null ? auth.getString("hmac-secret", "") : "";
        String hmacSecret = (envHmac != null && !envHmac.isBlank())
                ? envHmac
                : (cfgHmac == null ? "" : cfgHmac);

        return new ApiSettings(
                enabled,
                baseUrl == null || baseUrl.isBlank() ? "http://127.0.0.1:3000/api/v1" : baseUrl,
                serverId == null || serverId.isBlank() ? "survival-1" : serverId,
                Math.max(5, heartbeat),
                Math.max(500, connectTimeout),
                Math.max(500, readTimeout),
                listenEnabled,
                bind == null || bind.isBlank() ? "127.0.0.1" : bind,
                Math.max(1, Math.min(65535, port)),
                apiKey,
                hmacEnabled,
                hmacSecret,
                Math.max(10, Math.min(1000, pendingMax))
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

    public String baseUrl() {
        return baseUrl;
    }

    public String serverId() {
        return serverId;
    }

    public int heartbeatIntervalSeconds() {
        return heartbeatIntervalSeconds;
    }

    public int connectTimeoutMs() {
        return connectTimeoutMs;
    }

    public int readTimeoutMs() {
        return readTimeoutMs;
    }

    public boolean listenEnabled() {
        return listenEnabled;
    }

    public String listenBind() {
        return listenBind;
    }

    public int listenPort() {
        return listenPort;
    }

    /** Never log this value. */
    public String apiKey() {
        return apiKey;
    }

    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isBlank();
    }

    public boolean apiKeyFromEnv() {
        String env = getenv(ENV_API_KEY);
        return env != null && !env.isBlank();
    }

    public boolean hmacEnabled() {
        return hmacEnabled;
    }

    /** Never log this value. */
    public String hmacSecret() {
        return hmacSecret;
    }

    public boolean hasHmacSecret() {
        return hmacSecret != null && !hmacSecret.isBlank();
    }

    public int pendingQueueMax() {
        return pendingQueueMax;
    }

    /** Safe summary for logs — never includes secrets. */
    public String safeSummary() {
        return "enabled=" + enabled
                + ", baseUrl=" + baseUrl
                + ", serverId=" + serverId
                + ", heartbeat=" + heartbeatIntervalSeconds + "s"
                + ", listen=" + (listenEnabled ? (listenBind + ":" + listenPort) : "uit")
                + ", apiKey=" + (hasApiKey() ? (apiKeyFromEnv() ? "(env)" : "(config)") : "(leeg)")
                + ", hmac=" + (hmacEnabled ? (hasHmacSecret() ? "aan" : "aan-zonder-secret") : "uit");
    }
}

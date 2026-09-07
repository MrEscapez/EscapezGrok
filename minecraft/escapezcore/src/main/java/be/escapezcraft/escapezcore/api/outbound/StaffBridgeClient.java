package be.escapezcraft.escapezcore.api.outbound;

import be.escapezcraft.escapezcore.api.ApiAuth;
import be.escapezcraft.escapezcore.api.ApiJson;
import be.escapezcraft.escapezcore.api.ApiSettings;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Outbound EscapezCore → Staff Backend client.
 * Paths aligned with Staff Panel FASE 13 stubs:
 * <ul>
 *   <li>POST {@code /api/v1/bridge/heartbeat}</li>
 *   <li>POST {@code /api/v1/bridge/events}</li>
 * </ul>
 * Auth: {@code X-Escapez-Api-Key} (+ optional HMAC headers). Graceful when panel offline.
 */
public final class StaffBridgeClient {

    private final Logger logger;
    private final AtomicBoolean panelOnline = new AtomicBoolean(false);
    private final AtomicLong lastSuccessMs = new AtomicLong(0L);
    private final AtomicLong lastFailureMs = new AtomicLong(0L);
    private final AtomicLong consecutiveFailures = new AtomicLong(0L);
    private volatile ApiSettings settings;
    private final PendingEventQueue pending;

    public StaffBridgeClient(Logger logger, ApiSettings settings, PendingEventQueue pending) {
        this.logger = logger;
        this.settings = settings;
        this.pending = pending;
    }

    public void updateSettings(ApiSettings settings) {
        this.settings = settings;
    }

    public boolean isPanelOnline() {
        return panelOnline.get();
    }

    public long consecutiveFailures() {
        return consecutiveFailures.get();
    }

    public long lastSuccessMs() {
        return lastSuccessMs.get();
    }

    public int pendingSize() {
        return pending.size();
    }

    public boolean postHeartbeat(Map<String, Object> body) {
        ApiSettings s = settings;
        if (s == null || !s.enabled() || !s.hasApiKey()) {
            return false;
        }
        boolean ok = postJson(s.baseUrl() + "/bridge/heartbeat", body);
        if (ok) {
            markSuccess();
            flushPending(s);
        } else {
            markFailure("heartbeat");
        }
        return ok;
    }

    /**
     * Push event immediately, or enqueue if panel is offline / request fails.
     */
    public void pushEvent(String type, Map<String, Object> payload) {
        ApiSettings s = settings;
        if (s == null || !s.enabled() || !s.hasApiKey()) {
            return;
        }
        String ts = Instant.now().toString();
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("type", type);
        body.put("payload", payload == null ? Map.of() : payload);
        body.put("timestamp", ts);

        if (!panelOnline.get()) {
            pending.offer(type, payload, ts);
            return;
        }
        boolean ok = postJson(s.baseUrl() + "/bridge/events", body);
        if (!ok) {
            pending.offer(type, payload, ts);
            markFailure("event");
        }
    }

    private void flushPending(ApiSettings s) {
        List<Map<String, Object>> batch = pending.drain(25);
        if (batch.isEmpty()) {
            return;
        }
        List<Map<String, Object>> failed = new java.util.ArrayList<>();
        for (Map<String, Object> event : batch) {
            if (!postJson(s.baseUrl() + "/bridge/events", event)) {
                failed.add(event);
            }
        }
        if (!failed.isEmpty()) {
            pending.requeueFront(failed);
            markFailure("flush");
        }
    }

    private boolean postJson(String url, Map<String, Object> body) {
        ApiSettings s = settings;
        String raw = ApiJson.stringify(body);
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
            conn.setConnectTimeout(s.connectTimeoutMs());
            conn.setReadTimeout(s.readTimeoutMs());
            conn.setRequestMethod("POST");
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json; charset=utf-8");
            conn.setRequestProperty("Accept", "application/json");
            conn.setRequestProperty(ApiAuth.HEADER_API_KEY, s.apiKey());
            if (s.hmacEnabled() && s.hasHmacSecret()) {
                String ts = String.valueOf(System.currentTimeMillis());
                String sig = ApiAuth.sign(s.hmacSecret(), ts, raw);
                conn.setRequestProperty(ApiAuth.HEADER_TIMESTAMP, ts);
                conn.setRequestProperty(ApiAuth.HEADER_SIGNATURE, sig);
            }
            byte[] bytes = raw.getBytes(StandardCharsets.UTF_8);
            conn.setFixedLengthStreamingMode(bytes.length);
            try (OutputStream out = conn.getOutputStream()) {
                out.write(bytes);
            }
            int code = conn.getResponseCode();
            // Drain body to free connection
            try (InputStream in = code >= 400 ? conn.getErrorStream() : conn.getInputStream()) {
                if (in != null) {
                    in.readAllBytes();
                }
            }
            return code >= 200 && code < 300;
        } catch (Exception ex) {
            logger.log(Level.FINE, "Bridge POST mislukt: " + url, ex);
            return false;
        } finally {
            if (conn != null) {
                conn.disconnect();
            }
        }
    }

    private void markSuccess() {
        panelOnline.set(true);
        lastSuccessMs.set(System.currentTimeMillis());
        long fails = consecutiveFailures.getAndSet(0L);
        if (fails > 0) {
            logger.info("Staff Panel bridge weer online (na " + fails + " mislukte pogingen).");
        }
    }

    private void markFailure(String kind) {
        panelOnline.set(false);
        lastFailureMs.set(System.currentTimeMillis());
        long n = consecutiveFailures.incrementAndGet();
        // Rate-limit Dutch warnings
        if (n == 1L || n == 5L || n % 20L == 0L) {
            logger.warning("Staff Panel offline of onbereikbaar (" + kind
                    + ", pogingen=" + n + ", pending=" + pending.size()
                    + "). EscapezCore blijft draaien.");
        }
    }
}

package be.escapezcraft.escapezcore.api.inbound;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.api.ApiAuth;
import be.escapezcraft.escapezcore.api.ApiJson;
import be.escapezcraft.escapezcore.api.ApiSettings;
import be.escapezcraft.escapezcore.api.ModuleToggleService;
import be.escapezcraft.escapezcore.api.dto.ModuleStatusDto;
import be.escapezcraft.escapezcore.api.outbound.StaffBridgeClient;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.bukkit.Bukkit;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Inbound authenticated HTTP listener for Staff Backend → EscapezCore control plane.
 * <p>
 * Architecture choice: hybrid bridge — EscapezCore exposes a small JDK HttpServer that the
 * Staff Backend calls for module toggles/health, while outbound POSTs push heartbeat/events
 * to Nest stubs. Fits Paper plugins (no browser secrets; panel-offline safe).
 * <p>
 * Contract (Staff Panel Settings):
 * <ul>
 *   <li>{@code GET  /api/v1/modules}</li>
 *   <li>{@code PATCH /api/v1/modules/:id} body {@code { "enabled": true|false }}</li>
 * </ul>
 * Also: {@code GET /api/v1/health}, {@code GET /api/v1/status}.
 * Soft-reload never uses {@code join}/{@code get} on the Paper main thread.
 */
public final class ApiHttpServer {

    private static final Pattern MODULE_ID = Pattern.compile("^/api/v1/modules/([a-z0-9_-]+)/?$");

    private final EscapezCorePlugin plugin;
    private final ModuleToggleService modules;
    private final StaffBridgeClient bridgeClient;
    private volatile ApiSettings settings;
    private HttpServer server;

    public ApiHttpServer(
            EscapezCorePlugin plugin,
            ModuleToggleService modules,
            StaffBridgeClient bridgeClient,
            ApiSettings settings
    ) {
        this.plugin = plugin;
        this.modules = modules;
        this.bridgeClient = bridgeClient;
        this.settings = settings;
    }

    public void updateSettings(ApiSettings settings) {
        this.settings = settings;
    }

    public synchronized void start() throws IOException {
        stop();
        ApiSettings s = settings;
        if (s == null || !s.enabled() || !s.listenEnabled()) {
            return;
        }
        if (!s.hasApiKey()) {
            plugin.getLogger().warning("API listen uitgeschakeld: geen API-key (ESCAPEZ_API_KEY).");
            return;
        }
        InetSocketAddress addr = new InetSocketAddress(s.listenBind(), s.listenPort());
        server = HttpServer.create(addr, 0);
        // Single context — route by path (avoids prefix swallowing /modules/:id)
        server.createContext("/api/v1", this::dispatch);
        ThreadFactory tf = new ThreadFactory() {
            private final AtomicInteger n = new AtomicInteger();

            @Override
            public Thread newThread(Runnable r) {
                Thread t = new Thread(r, "EscapezCore-API-" + n.incrementAndGet());
                t.setDaemon(true);
                return t;
            }
        };
        server.setExecutor(Executors.newFixedThreadPool(4, tf));
        server.start();
        plugin.getLogger().info("API bridge listener actief op http://"
                + s.listenBind() + ":" + s.listenPort() + "/api/v1");
    }

    public synchronized void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
            plugin.getLogger().info("API bridge listener gestopt.");
        }
    }

    public boolean isRunning() {
        return server != null;
    }

    private void dispatch(HttpExchange ex) throws IOException {
        String path = ex.getRequestURI().getPath();
        if (path == null) {
            path = "";
        }
        // Normalize trailing slash except root
        if (path.length() > 1 && path.endsWith("/")) {
            path = path.substring(0, path.length() - 1);
        }

        Matcher m = MODULE_ID.matcher(path);
        if (m.matches()) {
            handleModuleById(ex, m.group(1));
            return;
        }
        if ("/api/v1/modules".equals(path)) {
            handleModulesRoot(ex);
            return;
        }
        if ("/api/v1/health".equals(path)) {
            handleHealth(ex);
            return;
        }
        if ("/api/v1/status".equals(path)) {
            handleStatus(ex);
            return;
        }
        writeError(ex, 404, "not_found", "Onbekend pad: " + path);
    }

    private void handleModulesRoot(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            writeError(ex, 405, "method_not_allowed", "Alleen GET toegestaan");
            return;
        }
        String body = readBody(ex);
        if (!authorize(ex, body)) {
            return;
        }
        List<Map<String, Object>> list = new ArrayList<>();
        for (ModuleStatusDto dto : modules.listModules()) {
            list.add(dto.toJson());
        }
        Map<String, Object> resp = new LinkedHashMap<>();
        resp.put("modules", list);
        writeJson(ex, 200, resp);
    }

    private void handleModuleById(HttpExchange ex, String id) throws IOException {
        String method = ex.getRequestMethod() == null ? "" : ex.getRequestMethod().toUpperCase(Locale.ROOT);
        String body = readBody(ex);
        if (!authorize(ex, body)) {
            return;
        }
        if ("GET".equals(method)) {
            Optional<ModuleStatusDto> opt = modules.getModule(id);
            if (opt.isEmpty()) {
                writeError(ex, 404, "module_not_found", "Onbekende module: " + id);
                return;
            }
            writeJson(ex, 200, opt.get().toJson());
            return;
        }
        if ("PATCH".equals(method)) {
            Map<String, Object> json;
            try {
                json = ApiJson.parseObject(body);
            } catch (Exception e) {
                writeError(ex, 400, "invalid_json", "Ongeldige JSON body");
                return;
            }
            if (!json.containsKey("enabled")) {
                writeError(ex, 400, "validation_error", "Body vereist veld 'enabled' (boolean)");
                return;
            }
            Object rawEnabled = json.get("enabled");
            boolean enabled;
            if (rawEnabled instanceof Boolean b) {
                enabled = b;
            } else if (rawEnabled instanceof String str
                    && ("true".equalsIgnoreCase(str) || "false".equalsIgnoreCase(str))) {
                enabled = Boolean.parseBoolean(str);
            } else {
                writeError(ex, 400, "validation_error", "'enabled' moet true of false zijn");
                return;
            }
            try {
                ModuleStatusDto dto = modules.setEnabledBlocking(id, enabled, 15_000L);
                Map<String, Object> resp = new LinkedHashMap<>();
                resp.put("ok", true);
                resp.put("module", dto.toJson());
                writeJson(ex, 200, resp);
            } catch (ModuleToggleService.NotFoundException nf) {
                writeError(ex, 404, "module_not_found", nf.getMessage());
            } catch (Exception e) {
                plugin.getLogger().log(Level.WARNING, "PATCH module mislukt: " + id, e);
                writeError(ex, 500, "soft_reload_failed",
                        e.getMessage() == null ? "Soft-reload mislukt" : e.getMessage());
            }
            return;
        }
        writeError(ex, 405, "method_not_allowed", "Alleen GET of PATCH toegestaan");
    }

    private void handleHealth(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            writeError(ex, 405, "method_not_allowed", "Alleen GET toegestaan");
            return;
        }
        String body = readBody(ex);
        if (!authorize(ex, body)) {
            return;
        }
        writeJson(ex, 200, buildHealth());
    }

    private void handleStatus(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            writeError(ex, 405, "method_not_allowed", "Alleen GET toegestaan");
            return;
        }
        String body = readBody(ex);
        if (!authorize(ex, body)) {
            return;
        }
        Map<String, Object> status = buildHealth();
        List<Map<String, Object>> list = new ArrayList<>();
        for (ModuleStatusDto dto : modules.listModules()) {
            list.add(dto.toJson());
        }
        status.put("modules", list);
        writeJson(ex, 200, status);
    }

    private Map<String, Object> buildHealth() {
        ApiSettings s = settings;
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("ok", true);
        map.put("service", "escapezcore");
        map.put("version", plugin.getPluginMeta().getVersion());
        map.put("serverId", s == null ? "" : s.serverId());
        map.put("playersOnline", Bukkit.getOnlinePlayers().size());
        map.put("tps", readTps());
        map.put("panelOnline", bridgeClient != null && bridgeClient.isPanelOnline());
        map.put("pendingEvents", bridgeClient == null ? 0 : bridgeClient.pendingSize());
        map.put("timestamp", Instant.now().toString());
        return map;
    }

    private Double readTps() {
        try {
            double[] tps = Bukkit.getTPS();
            if (tps != null && tps.length > 0) {
                return Math.round(tps[0] * 100.0) / 100.0;
            }
        } catch (Throwable ignored) {
            // older/mocked environments
        }
        return null;
    }

    private boolean authorize(HttpExchange ex, String rawBody) throws IOException {
        ApiSettings s = settings;
        if (s == null || !s.hasApiKey()) {
            writeError(ex, 503, "api_disabled", "API bridge niet geconfigureerd");
            return false;
        }
        Headers headers = ex.getRequestHeaders();
        String key = firstHeader(headers, ApiAuth.HEADER_API_KEY);
        String ts = firstHeader(headers, ApiAuth.HEADER_TIMESTAMP);
        String sig = firstHeader(headers, ApiAuth.HEADER_SIGNATURE);
        if (!ApiAuth.verifyInbound(s, key, ts, sig, rawBody)) {
            writeError(ex, 401, "unauthorized", "Ongeldige of ontbrekende X-Escapez-Api-Key");
            return false;
        }
        return true;
    }

    private static String firstHeader(Headers headers, String name) {
        List<String> values = headers.get(name);
        if (values == null || values.isEmpty()) {
            for (String k : headers.keySet()) {
                if (k != null && k.equalsIgnoreCase(name)) {
                    List<String> v = headers.get(k);
                    return v == null || v.isEmpty() ? null : v.get(0);
                }
            }
            return null;
        }
        return values.get(0);
    }

    private static String readBody(HttpExchange ex) throws IOException {
        try (InputStream in = ex.getRequestBody()) {
            if (in == null) {
                return "";
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void writeJson(HttpExchange ex, int code, Map<String, Object> body) throws IOException {
        byte[] bytes = ApiJson.stringify(body).getBytes(StandardCharsets.UTF_8);
        ex.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream out = ex.getResponseBody()) {
            out.write(bytes);
        }
    }

    private static void writeError(HttpExchange ex, int code, String error, String message) throws IOException {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("ok", false);
        body.put("error", error);
        body.put("message", message);
        body.put("status", code);
        writeJson(ex, code, body);
    }
}

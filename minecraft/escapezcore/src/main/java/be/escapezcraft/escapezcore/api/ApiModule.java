package be.escapezcraft.escapezcore.api;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.api.inbound.ApiHttpServer;
import be.escapezcraft.escapezcore.api.outbound.PendingEventQueue;
import be.escapezcraft.escapezcore.api.outbound.StaffBridgeClient;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.module.Module;
import org.bukkit.Bukkit;
import org.bukkit.scheduler.BukkitTask;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.logging.Level;

/**
 * FASE 10 — secure API bridge to Staff Panel.
 * <p>
 * Hybrid pattern:
 * <ul>
 *   <li>Outbound: heartbeat + events → Nest {@code POST /api/v1/bridge/*}</li>
 *   <li>Inbound: JDK HttpServer for {@code GET/PATCH /api/v1/modules*} (Staff Settings)</li>
 * </ul>
 * Plugin remains fully operational when the panel is offline (pending event queue).
 */
public final class ApiModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;

    private ApiSettings settings;
    private ModuleToggleService toggleService;
    private PendingEventQueue pendingQueue;
    private StaffBridgeClient bridgeClient;
    private ApiHttpServer httpServer;
    private BukkitTask heartbeatTask;
    private boolean running;

    public ApiModule(EscapezCorePlugin plugin, ConfigManager configManager) {
        this.plugin = plugin;
        this.configManager = configManager;
    }

    @Override
    public String getName() {
        return "ApiModule";
    }

    @Override
    public void enable() {
        this.settings = ApiSettings.fromConfig(configManager.getConfig());
        this.toggleService = new ModuleToggleService(plugin, configManager);
        this.pendingQueue = new PendingEventQueue(settings.pendingQueueMax());
        this.bridgeClient = new StaffBridgeClient(plugin.getLogger(), settings, pendingQueue);
        this.httpServer = new ApiHttpServer(plugin, toggleService, bridgeClient, settings);

        if (!settings.enabled()) {
            plugin.getLogger().info("API bridge uitgeschakeld (api.enabled=false).");
            running = false;
            return;
        }

        startServices();
        running = true;
        plugin.getLogger().info("API bridge gestart — " + settings.safeSummary());
    }

    @Override
    public void disable() {
        stopServices();
        running = false;
    }

    @Override
    public void reload() {
        stopServices();
        this.settings = ApiSettings.fromConfig(configManager.getConfig());
        if (toggleService == null) {
            toggleService = new ModuleToggleService(plugin, configManager);
        }
        if (pendingQueue == null) {
            pendingQueue = new PendingEventQueue(settings.pendingQueueMax());
        }
        if (bridgeClient == null) {
            bridgeClient = new StaffBridgeClient(plugin.getLogger(), settings, pendingQueue);
        } else {
            bridgeClient.updateSettings(settings);
        }
        if (httpServer == null) {
            httpServer = new ApiHttpServer(plugin, toggleService, bridgeClient, settings);
        } else {
            httpServer.updateSettings(settings);
        }
        if (!settings.enabled()) {
            running = false;
            plugin.getLogger().info("API bridge herladen — uitgeschakeld.");
            return;
        }
        startServices();
        running = true;
        plugin.getLogger().info("API bridge herladen — " + settings.safeSummary());
    }

    private void startServices() {
        try {
            httpServer.start();
        } catch (Exception ex) {
            plugin.getLogger().log(Level.WARNING,
                    "Kon API listener niet starten (plugin blijft draaien): " + ex.getMessage(), ex);
        }
        scheduleHeartbeat();
        // Immediate async heartbeat attempt (never on main join)
        Bukkit.getScheduler().runTaskAsynchronously(plugin, this::sendHeartbeat);
    }

    private void stopServices() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel();
            heartbeatTask = null;
        }
        if (httpServer != null) {
            httpServer.stop();
        }
    }

    private void scheduleHeartbeat() {
        if (heartbeatTask != null) {
            heartbeatTask.cancel();
        }
        long periodTicks = Math.max(5, settings.heartbeatIntervalSeconds()) * 20L;
        heartbeatTask = Bukkit.getScheduler().runTaskTimerAsynchronously(
                plugin, this::sendHeartbeat, periodTicks, periodTicks);
    }

    private void sendHeartbeat() {
        if (settings == null || !settings.enabled() || bridgeClient == null) {
            return;
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("serverId", settings.serverId());
        body.put("status", "online");
        body.put("playersOnline", Bukkit.getOnlinePlayers().size());
        body.put("maxPlayers", Bukkit.getMaxPlayers());
        body.put("version", plugin.getPluginMeta().getVersion());
        Double tps = readTps();
        if (tps != null) {
            body.put("tps", tps);
        }
        body.put("modules", toggleService == null ? java.util.List.of()
                : toggleService.listModules().stream().map(m -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("id", m.id());
                    row.put("enabled", m.enabled());
                    row.put("active", m.active());
                    return row;
                }).toList());
        bridgeClient.postHeartbeat(body);
    }

    private Double readTps() {
        try {
            double[] tps = Bukkit.getTPS();
            if (tps != null && tps.length > 0) {
                return Math.round(tps[0] * 100.0) / 100.0;
            }
        } catch (Throwable ignored) {
        }
        return null;
    }

    /** Thin events channel — queues when panel offline. */
    public void publishEvent(String type, Map<String, Object> payload) {
        if (bridgeClient == null || settings == null || !settings.enabled()) {
            return;
        }
        bridgeClient.pushEvent(type, payload);
    }

    public ApiSettings getSettings() {
        return settings;
    }

    public StaffBridgeClient getBridgeClient() {
        return bridgeClient;
    }

    public ModuleToggleService getToggleService() {
        return toggleService;
    }

    public ApiHttpServer getHttpServer() {
        return httpServer;
    }

    public boolean isRunning() {
        return running;
    }

    public Map<String, Object> statusSnapshot() {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("enabled", settings != null && settings.enabled());
        map.put("running", running);
        map.put("listen", httpServer != null && httpServer.isRunning());
        map.put("panelOnline", bridgeClient != null && bridgeClient.isPanelOnline());
        map.put("pendingEvents", bridgeClient == null ? 0 : bridgeClient.pendingSize());
        map.put("failures", bridgeClient == null ? 0 : bridgeClient.consecutiveFailures());
        if (settings != null) {
            map.put("summary", settings.safeSummary());
        }
        return map;
    }
}

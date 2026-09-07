package be.escapezcraft.escapezcore.api;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.api.dto.ModuleStatusDto;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.items.ItemsModule;
import be.escapezcraft.escapezcore.module.Module;
import be.escapezcraft.escapezcore.report.ReportModule;
import be.escapezcraft.escapezcore.resourcepack.ResourcePackModule;
import be.escapezcraft.escapezcore.scoreboard.ScoreboardModule;
import be.escapezcraft.escapezcore.staffchat.StaffChatModule;
import be.escapezcraft.escapezcore.tips.TipsModule;
import be.escapezcraft.escapezcore.vote.VoteReminderModule;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;

import java.io.File;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;
import java.util.logging.Level;

/**
 * GET/PATCH module status with soft-reload. Bukkit work runs on the main thread via scheduler;
 * callers on HTTP worker threads may await the future — never {@code join}/{@code get} on main.
 */
public final class ModuleToggleService {

    public static final List<String> MODULE_IDS = List.of(
            "scoreboard", "tips", "vote", "resourcepack", "reports", "staffchat", "items"
    );

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final Map<String, FeatureDef> features = new LinkedHashMap<>();

    public ModuleToggleService(EscapezCorePlugin plugin, ConfigManager configManager) {
        this.plugin = plugin;
        this.configManager = configManager;
        registerDefaults();
    }

    private void registerDefaults() {
        features.put("scoreboard", new FeatureDef(
                "scoreboard",
                "Scoreboard",
                ConfigFile.SCOREBOARD,
                "scoreboard.enabled",
                true,
                () -> plugin.getScoreboardModule(),
                () -> {
                    ScoreboardModule m = plugin.getScoreboardModule();
                    return m != null && m.getService() != null && m.getService().isFeatureEnabled();
                }
        ));
        features.put("tips", new FeatureDef(
                "tips",
                "Tips",
                ConfigFile.SCOREBOARD,
                "tips.enabled",
                true,
                () -> plugin.getTipsModule(),
                () -> {
                    TipsModule m = plugin.getTipsModule();
                    return m != null && configManager.getScoreboard().getBoolean("tips.enabled", true);
                }
        ));
        features.put("vote", new FeatureDef(
                "vote",
                "Vote reminders",
                ConfigFile.SCOREBOARD,
                "vote-reminder.enabled",
                true,
                () -> plugin.getVoteReminderModule(),
                () -> configManager.getScoreboard().getBoolean("vote-reminder.enabled", true)
        ));
        features.put("resourcepack", new FeatureDef(
                "resourcepack",
                "Resource pack",
                ConfigFile.RESOURCEPACK,
                "enabled",
                false,
                () -> plugin.getResourcePackModule(),
                () -> {
                    ResourcePackModule m = plugin.getResourcePackModule();
                    return m != null && m.isEnabled();
                }
        ));
        features.put("reports", new FeatureDef(
                "reports",
                "Reports",
                ConfigFile.CONFIG,
                "reports.enabled",
                true,
                () -> plugin.getReportModule(),
                () -> {
                    ReportModule m = plugin.getReportModule();
                    return m != null && configManager.getConfig().getBoolean("reports.enabled", true)
                            && m.getService() != null && m.getService().isEnabled();
                }
        ));
        features.put("staffchat", new FeatureDef(
                "staffchat",
                "Staffchat",
                ConfigFile.CONFIG,
                "staffchat.enabled",
                true,
                () -> plugin.getStaffChatModule(),
                () -> {
                    StaffChatModule m = plugin.getStaffChatModule();
                    return m != null && m.isFeatureEnabled();
                }
        ));
        features.put("items", new FeatureDef(
                "items",
                "Custom items",
                ConfigFile.ITEMS,
                "enabled",
                true,
                () -> plugin.getItemsModule(),
                () -> {
                    ItemsModule m = plugin.getItemsModule();
                    return m != null && m.isEnabled();
                }
        ));
    }

    public List<ModuleStatusDto> listModules() {
        List<ModuleStatusDto> list = new ArrayList<>();
        for (String id : MODULE_IDS) {
            FeatureDef def = features.get(id);
            if (def != null) {
                list.add(toDto(def));
            }
        }
        return list;
    }

    public Optional<ModuleStatusDto> getModule(String id) {
        FeatureDef def = features.get(normalize(id));
        return def == null ? Optional.empty() : Optional.of(toDto(def));
    }

    /**
     * Persist enabled flag and soft-reload the module on the main thread.
     * Safe to {@code get()} from an HTTP worker — never call from the Paper main thread.
     */
    public CompletableFuture<ModuleStatusDto> setEnabled(String id, boolean enabled) {
        String key = normalize(id);
        FeatureDef def = features.get(key);
        if (def == null) {
            return CompletableFuture.failedFuture(new NotFoundException("Onbekende module: " + id));
        }
        if (Bukkit.isPrimaryThread()) {
            return CompletableFuture.failedFuture(new IllegalStateException(
                    "setEnabled mag niet op de Paper main thread geawait worden"));
        }
        CompletableFuture<ModuleStatusDto> future = new CompletableFuture<>();
        Bukkit.getScheduler().runTask(plugin, () -> {
            try {
                persistEnabled(def, enabled);
                softReload(def);
                ModuleStatusDto dto = toDto(def);
                plugin.getLogger().info("API module-toggle: " + def.id + " → enabled=" + enabled
                        + " (soft-reload OK)");
                future.complete(dto);
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "Module-toggle mislukt voor " + def.id, ex);
                future.completeExceptionally(ex);
            }
        });
        return future;
    }

    /** Await helper for HTTP workers only. */
    public ModuleStatusDto setEnabledBlocking(String id, boolean enabled, long timeoutMs) throws Exception {
        if (Bukkit.isPrimaryThread()) {
            throw new IllegalStateException("Geen blocking await op Paper main thread");
        }
        return setEnabled(id, enabled).get(timeoutMs, TimeUnit.MILLISECONDS);
    }

    private ModuleStatusDto toDto(FeatureDef def) {
        boolean enabled = readEnabled(def);
        boolean active = false;
        try {
            active = enabled && def.activeCheck.getAsBoolean();
        } catch (Exception ignored) {
            active = enabled;
        }
        return new ModuleStatusDto(def.id, def.displayName, enabled, active, true);
    }

    private boolean readEnabled(FeatureDef def) {
        FileConfiguration yaml = yamlFor(def.file);
        if (yaml == null) {
            return def.defaultEnabled;
        }
        return yaml.getBoolean(def.configPath, def.defaultEnabled);
    }

    private void persistEnabled(FeatureDef def, boolean enabled) throws Exception {
        FileConfiguration yaml = yamlFor(def.file);
        if (yaml == null) {
            throw new IllegalStateException("Config niet geladen voor " + def.file);
        }
        yaml.set(def.configPath, enabled);
        File file = fileFor(def.file);
        yaml.save(file);
        // Keep in-memory ConfigManager views consistent for subsequent reads
        configManager.loadAll();
    }

    private void softReload(FeatureDef def) throws Exception {
        Module module = def.moduleSupplier.get();
        if (module == null) {
            throw new IllegalStateException("Module niet beschikbaar: " + def.id);
        }
        module.reload();
    }

    private FileConfiguration yamlFor(ConfigFile file) {
        return switch (file) {
            case CONFIG -> configManager.getConfig();
            case SCOREBOARD -> configManager.getScoreboard();
            case RESOURCEPACK -> configManager.getResourcePack();
            case ITEMS -> configManager.getItems();
        };
    }

    private File fileFor(ConfigFile file) {
        String name = switch (file) {
            case CONFIG -> "config.yml";
            case SCOREBOARD -> "scoreboard.yml";
            case RESOURCEPACK -> "resourcepack.yml";
            case ITEMS -> "items.yml";
        };
        return new File(plugin.getDataFolder(), name);
    }

    private static String normalize(String id) {
        return id == null ? "" : id.trim().toLowerCase(Locale.ROOT);
    }

    public static final class NotFoundException extends Exception {
        public NotFoundException(String message) {
            super(message);
        }
    }

    private enum ConfigFile {
        CONFIG, SCOREBOARD, RESOURCEPACK, ITEMS
    }

    private record FeatureDef(
            String id,
            String displayName,
            ConfigFile file,
            String configPath,
            boolean defaultEnabled,
            Supplier<Module> moduleSupplier,
            BooleanSupplier activeCheck
    ) {
    }
}

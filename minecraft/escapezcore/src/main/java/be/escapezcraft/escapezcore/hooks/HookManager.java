package be.escapezcraft.escapezcore.hooks;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.hooks.adapters.DetectOnlyAdapter;
import be.escapezcraft.escapezcore.hooks.adapters.ItemsAdderAdapter;
import be.escapezcraft.escapezcore.hooks.adapters.LuckPermsAdapter;
import be.escapezcraft.escapezcore.hooks.adapters.NexoAdapter;
import be.escapezcraft.escapezcore.hooks.adapters.PlaceholderApiAdapter;
import be.escapezcraft.escapezcore.hooks.adapters.VaultAdapter;
import be.escapezcraft.escapezcore.module.Module;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Soft-dependency integrations layer: detect, enable/disable via integrations.yml,
 * adapters with compileOnly / reflection / detect-only modes. Never crashes when absent.
 */
public final class HookManager implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;

    private final Map<String, PluginAdapter> byId = new LinkedHashMap<>();
    private final Map<Class<? extends PluginAdapter>, PluginAdapter> byType = new LinkedHashMap<>();
    private final Map<String, Boolean> detected = new LinkedHashMap<>();

    private LuckPermsAdapter luckPerms;
    private VaultAdapter vault;
    private PlaceholderApiAdapter placeholderApi;
    private ItemsAdderAdapter itemsAdder;
    private NexoAdapter nexo;

    public HookManager(EscapezCorePlugin plugin, ConfigManager configManager) {
        this.plugin = plugin;
        this.configManager = configManager;
        registerDefaults();
    }

    private void registerDefaults() {
        luckPerms = registerTyped(new LuckPermsAdapter(plugin));
        vault = registerTyped(new VaultAdapter(plugin));
        placeholderApi = registerTyped(new PlaceholderApiAdapter(plugin));
        itemsAdder = registerTyped(new ItemsAdderAdapter(plugin));
        nexo = registerTyped(new NexoAdapter(plugin));

        // Reflection-ready ecosystem members kept as detect-only until a stable public API is wired
        register(new DetectOnlyAdapter(plugin, "litebans", "LiteBans"));
        register(new DetectOnlyAdapter(plugin, "worldguard", "WorldGuard"));
        register(new DetectOnlyAdapter(plugin, "coreprotect", "CoreProtect"));
        register(new DetectOnlyAdapter(plugin, "lands", "Lands"));
        register(new DetectOnlyAdapter(plugin, "mcmmo", "McMMO"));
        register(new DetectOnlyAdapter(plugin, "excellentcrates", "ExcellentCrates"));
        register(new DetectOnlyAdapter(plugin, "mythicmobs", "MythicMobs"));
        register(new DetectOnlyAdapter(plugin, "modelengine", "ModelEngine"));
        register(new DetectOnlyAdapter(plugin, "cmi", "CMI"));
        register(new DetectOnlyAdapter(plugin, "protocollib", "ProtocolLib"));
        // Ecosystem detection-only (optional softdepends)
        register(new DetectOnlyAdapter(plugin, "viaversion", "ViaVersion"));
        register(new DetectOnlyAdapter(plugin, "worldedit", "WorldEdit"));
    }

    private void register(PluginAdapter adapter) {
        byId.put(adapter.id().toLowerCase(), adapter);
    }

    @SuppressWarnings("unchecked")
    private <T extends PluginAdapter> T registerTyped(T adapter) {
        register(adapter);
        byType.put((Class<? extends PluginAdapter>) adapter.getClass(), adapter);
        return adapter;
    }

    @Override
    public String getName() {
        return "HookManager";
    }

    @Override
    public void enable() {
        scan();
    }

    @Override
    public void disable() {
        for (PluginAdapter adapter : byId.values()) {
            adapter.unhook();
        }
        detected.clear();
    }

    @Override
    public void reload() {
        scan();
    }

    /**
     * Soft-reload / enable: apply integrations.yml flags and (re)hook all adapters.
     */
    public void scan() {
        applyConfigFlags();
        detected.clear();
        for (PluginAdapter adapter : byId.values()) {
            adapter.hook();
            detected.put(adapter.pluginName(), adapter.isPresent());
        }
    }

    private void applyConfigFlags() {
        FileConfiguration yaml = configManager.getIntegrations();
        ConfigurationSection root = yaml == null ? null : yaml.getConfigurationSection("integrations");
        for (PluginAdapter adapter : byId.values()) {
            boolean enabled = true;
            if (root != null) {
                ConfigurationSection section = root.getConfigurationSection(adapter.id());
                if (section != null) {
                    enabled = section.getBoolean("enabled", true);
                } else if (root.contains(adapter.id())) {
                    // allow integrations.luckperms: true shorthand
                    Object raw = root.get(adapter.id());
                    if (raw instanceof Boolean b) {
                        enabled = b;
                    }
                }
            }
            if (adapter instanceof be.escapezcraft.escapezcore.hooks.adapters.AbstractPluginAdapter abs) {
                abs.setConfigEnabled(enabled);
            }
        }
    }

    public boolean isPresent(String pluginName) {
        if (pluginName == null) {
            return false;
        }
        Boolean cached = detected.get(pluginName);
        if (cached != null) {
            return cached;
        }
        PluginAdapter adapter = findByPluginName(pluginName);
        return adapter != null && adapter.isPresent();
    }

    public boolean isAvailable(String integrationId) {
        return getAdapter(integrationId).map(PluginAdapter::isAvailable).orElse(false);
    }

    public boolean isAvailable(Class<? extends PluginAdapter> type) {
        return getAdapter(type).map(PluginAdapter::isAvailable).orElse(false);
    }

    @SuppressWarnings("unchecked")
    public <T extends PluginAdapter> Optional<T> getAdapter(Class<T> type) {
        PluginAdapter adapter = byType.get(type);
        if (adapter != null) {
            return Optional.of((T) adapter);
        }
        for (PluginAdapter candidate : byId.values()) {
            if (type.isInstance(candidate)) {
                return Optional.of((T) candidate);
            }
        }
        return Optional.empty();
    }

    public Optional<PluginAdapter> getAdapter(String integrationId) {
        if (integrationId == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(byId.get(integrationId.toLowerCase()));
    }

    public Map<String, Boolean> getDetected() {
        return Collections.unmodifiableMap(detected);
    }

    public List<PluginAdapter> adapters() {
        return Collections.unmodifiableList(new ArrayList<>(byId.values()));
    }

    public LuckPermsAdapter luckPerms() {
        return luckPerms;
    }

    public VaultAdapter vault() {
        return vault;
    }

    public PlaceholderApiAdapter placeholderApi() {
        return placeholderApi;
    }

    public ItemsAdderAdapter itemsAdder() {
        return itemsAdder;
    }

    public NexoAdapter nexo() {
        return nexo;
    }

    private PluginAdapter findByPluginName(String pluginName) {
        for (PluginAdapter adapter : byId.values()) {
            if (adapter.pluginName().equalsIgnoreCase(pluginName)) {
                return adapter;
            }
        }
        return null;
    }
}

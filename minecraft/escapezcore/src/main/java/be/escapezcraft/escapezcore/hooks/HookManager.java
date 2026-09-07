package be.escapezcraft.escapezcore.hooks;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.module.Module;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Detects soft-depend plugins only — logs disabled, never fabricates APIs.
 */
public final class HookManager implements Module {

    private static final String[] TRACKED = {
            "LuckPerms", "Vault", "PlaceholderAPI", "LiteBans", "WorldGuard",
            "Lands", "McMMO", "ItemsAdder", "Nexo", "ExcellentCrates",
            "CoreProtect", "ProtocolLib", "CMI"
    };

    private final EscapezCorePlugin plugin;
    private final Map<String, Boolean> detected = new LinkedHashMap<>();

    public HookManager(EscapezCorePlugin plugin) {
        this.plugin = plugin;
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
        detected.clear();
    }

    @Override
    public void reload() {
        scan();
    }

    public void scan() {
        detected.clear();
        for (String name : TRACKED) {
            Plugin p = Bukkit.getPluginManager().getPlugin(name);
            boolean present = p != null && p.isEnabled();
            detected.put(name, present);
            if (present) {
                plugin.getLogger().info("Hook detected: " + name + " (enabled)");
            } else {
                plugin.getLogger().info("Hook disabled / not present: " + name);
            }
        }
    }

    public boolean isPresent(String pluginName) {
        return Boolean.TRUE.equals(detected.get(pluginName));
    }

    public Map<String, Boolean> getDetected() {
        return Collections.unmodifiableMap(detected);
    }

    public Set<String> trackedNames() {
        return Set.of(TRACKED);
    }
}

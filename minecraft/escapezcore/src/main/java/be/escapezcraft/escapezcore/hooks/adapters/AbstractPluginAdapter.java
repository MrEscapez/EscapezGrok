package be.escapezcraft.escapezcore.hooks.adapters;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.AdapterMode;
import be.escapezcraft.escapezcore.hooks.PluginAdapter;
import org.bukkit.Bukkit;
import org.bukkit.plugin.Plugin;

import java.util.logging.Level;

/**
 * Shared presence / config / hook lifecycle for soft-dep adapters.
 */
public abstract class AbstractPluginAdapter implements PluginAdapter {

    protected final EscapezCorePlugin plugin;
    private final String id;
    private final String pluginName;
    private final AdapterMode mode;

    private volatile boolean configEnabled = true;
    private volatile boolean hooked;

    protected AbstractPluginAdapter(
            EscapezCorePlugin plugin,
            String id,
            String pluginName,
            AdapterMode mode
    ) {
        this.plugin = plugin;
        this.id = id;
        this.pluginName = pluginName;
        this.mode = mode;
    }

    @Override
    public final String id() {
        return id;
    }

    @Override
    public final String pluginName() {
        return pluginName;
    }

    @Override
    public final AdapterMode mode() {
        return mode;
    }

    @Override
    public final boolean isPresent() {
        Plugin p = Bukkit.getPluginManager().getPlugin(pluginName);
        return p != null && p.isEnabled();
    }

    @Override
    public final boolean isConfigEnabled() {
        return configEnabled;
    }

    public final void setConfigEnabled(boolean enabled) {
        this.configEnabled = enabled;
    }

    @Override
    public final boolean isAvailable() {
        return configEnabled && isPresent() && hooked;
    }

    protected final boolean isHooked() {
        return hooked;
    }

    @Override
    public final void hook() {
        unhook();
        if (!configEnabled) {
            plugin.getLogger().info("Integratie '" + id + "' (" + pluginName + ") uitgeschakeld in integrations.yml.");
            return;
        }
        if (!isPresent()) {
            plugin.getLogger().info("Integratie '" + id + "' — plugin niet aanwezig: " + pluginName);
            return;
        }
        try {
            boolean ok = onHook();
            hooked = ok;
            if (ok) {
                plugin.getLogger().info("Integratie actief: " + pluginName + " [" + mode.name().toLowerCase() + "]");
            } else {
                plugin.getLogger().warning("Integratie aanwezig maar hook mislukt: " + pluginName
                        + " — features die hiervan afhangen blijven uit.");
            }
        } catch (Throwable t) {
            hooked = false;
            plugin.getLogger().log(Level.WARNING,
                    "Integratie hook exception voor " + pluginName + " (graceful disable): " + t.getMessage(), t);
        }
    }

    @Override
    public final void unhook() {
        try {
            onUnhook();
        } catch (Throwable t) {
            plugin.debugLog("unhook " + id + ": " + t);
        } finally {
            hooked = false;
        }
    }

    /**
     * @return true when the adapter is ready for thin wrappers / detection consumers
     */
    protected abstract boolean onHook() throws Exception;

    protected void onUnhook() {
        // default no-op
    }
}

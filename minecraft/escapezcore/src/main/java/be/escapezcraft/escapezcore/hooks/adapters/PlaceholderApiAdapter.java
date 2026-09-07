package be.escapezcraft.escapezcore.hooks.adapters;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.AdapterMode;
import me.clip.placeholderapi.PlaceholderAPI;
import org.bukkit.OfflinePlayer;
import org.bukkit.entity.Player;

/**
 * PlaceholderAPI soft-dep via official API (compileOnly {@code me.clip:placeholderapi}).
 */
public final class PlaceholderApiAdapter extends AbstractPluginAdapter {

    public PlaceholderApiAdapter(EscapezCorePlugin plugin) {
        super(plugin, "placeholderapi", "PlaceholderAPI", AdapterMode.COMPILE_ONLY);
    }

    @Override
    protected boolean onHook() {
        // Class is on classpath at compile time; presence of plugin is enough.
        return true;
    }

    /**
     * Apply PAPI placeholders; returns input unchanged when unavailable or on error.
     */
    public String setPlaceholders(Player player, String text) {
        if (!isAvailable() || text == null || text.isEmpty() || player == null) {
            return text == null ? "" : text;
        }
        try {
            return PlaceholderAPI.setPlaceholders((OfflinePlayer) player, text);
        } catch (Throwable t) {
            plugin.debugLog("PAPI setPlaceholders: " + t.getMessage());
            return text;
        }
    }
}

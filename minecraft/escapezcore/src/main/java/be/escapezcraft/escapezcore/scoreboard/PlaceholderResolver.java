package be.escapezcraft.escapezcore.scoreboard;

import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.hooks.adapters.PlaceholderApiAdapter;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Resolves built-in brace placeholders and optional PlaceholderAPI {@code %...%}
 * via {@link PlaceholderApiAdapter} (compileOnly soft-dep).
 */
public final class PlaceholderResolver {

    private static final Pattern PAPI_PATTERN = Pattern.compile("%[^%\\s]+%");

    private final HookManager hookManager;

    public PlaceholderResolver(HookManager hookManager) {
        this.hookManager = hookManager;
    }

    /**
     * Soft-reload hook — adapters are rescanned by HookManager; nothing else to cache.
     */
    public void refresh() {
        // no-op: PlaceholderApiAdapter is re-hooked by HookManager.scan()
    }

    public boolean isPapiAvailable() {
        return hookManager.getAdapter(PlaceholderApiAdapter.class)
                .map(PlaceholderApiAdapter::isAvailable)
                .orElse(false);
    }

    /**
     * Apply built-in braces, then PAPI when present.
     *
     * @param missingPapiMode {@code leave} keeps {@code %...%} when PAPI absent; {@code strip} removes them
     */
    public String resolve(Player player, String input, String missingPapiMode) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        Map<String, String> braces = builtIn(player);
        String raw = MessagesService.applyBracePlaceholders(input, braces);
        var papi = hookManager.getAdapter(PlaceholderApiAdapter.class);
        if (papi.isPresent() && papi.get().isAvailable()) {
            return papi.get().setPlaceholders(player, raw);
        }
        if ("strip".equalsIgnoreCase(missingPapiMode)) {
            return PAPI_PATTERN.matcher(raw).replaceAll("");
        }
        return raw;
    }

    public Map<String, String> builtIn(Player player) {
        Map<String, String> map = new LinkedHashMap<>();
        String name = player.getName();
        map.put("player", name);
        map.put("player_name", name);
        map.put("world", player.getWorld().getName());
        map.put("online", String.valueOf(Bukkit.getOnlinePlayers().size()));
        map.put("max", String.valueOf(Bukkit.getMaxPlayers()));
        map.put("max_online", String.valueOf(Bukkit.getMaxPlayers()));
        map.put("ping", String.valueOf(player.getPing()));
        return map;
    }
}

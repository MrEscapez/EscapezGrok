package be.escapezcraft.escapezcore.scoreboard;

import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Resolves built-in brace placeholders and optional PlaceholderAPI {@code %...%}
 * via soft reflection (never hard-depends on PAPI).
 */
public final class PlaceholderResolver {

    private static final Pattern PAPI_PATTERN = Pattern.compile("%[^%\\s]+%");

    private final HookManager hookManager;
    private volatile Method setPlaceholders;
    private volatile boolean papiResolved;
    private volatile boolean papiAvailable;

    public PlaceholderResolver(HookManager hookManager) {
        this.hookManager = hookManager;
    }

    public void refresh() {
        papiResolved = false;
        setPlaceholders = null;
        papiAvailable = false;
        resolvePapi();
    }

    private void resolvePapi() {
        if (papiResolved) {
            return;
        }
        papiResolved = true;
        if (!hookManager.isPresent("PlaceholderAPI")) {
            papiAvailable = false;
            return;
        }
        try {
            Class<?> clazz = Class.forName("me.clip.placeholderapi.PlaceholderAPI");
            setPlaceholders = clazz.getMethod("setPlaceholders", org.bukkit.OfflinePlayer.class, String.class);
            papiAvailable = true;
        } catch (ReflectiveOperationException ex) {
            papiAvailable = false;
            setPlaceholders = null;
        }
    }

    public boolean isPapiAvailable() {
        resolvePapi();
        return papiAvailable;
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
        resolvePapi();
        if (papiAvailable && setPlaceholders != null) {
            try {
                Object out = setPlaceholders.invoke(null, player, raw);
                if (out instanceof String s) {
                    return s;
                }
            } catch (ReflectiveOperationException ignored) {
                // leave raw — never crash
            }
            return raw;
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

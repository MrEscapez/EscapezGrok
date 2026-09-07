package be.escapezcraft.escapezcore.command;

import org.bukkit.entity.Player;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory cooldowns keyed by player UUID + command id.
 * Global bypass: escapezcore.cooldown.bypass; optional per-command bypass from commands.yml.
 */
public final class CooldownService {

    public static final String BYPASS_PERMISSION = "escapezcore.cooldown.bypass";

    private final Map<String, Long> expiresAt = new ConcurrentHashMap<>();

    private static String key(UUID uuid, String commandId) {
        return uuid.toString() + ":" + commandId;
    }

    /**
     * @return remaining seconds, or 0 if allowed
     */
    public int remainingSeconds(Player player, String commandId, int cooldownSeconds) {
        return remainingSeconds(player, commandId, cooldownSeconds, BYPASS_PERMISSION);
    }

    public int remainingSeconds(Player player, String commandId, int cooldownSeconds, String bypassPermission) {
        if (cooldownSeconds <= 0 || hasBypass(player, bypassPermission)) {
            return 0;
        }
        Long until = expiresAt.get(key(player.getUniqueId(), commandId));
        if (until == null) {
            return 0;
        }
        long now = System.currentTimeMillis();
        if (now >= until) {
            expiresAt.remove(key(player.getUniqueId(), commandId));
            return 0;
        }
        return (int) Math.ceil((until - now) / 1000.0);
    }

    public void apply(Player player, String commandId, int cooldownSeconds) {
        apply(player, commandId, cooldownSeconds, BYPASS_PERMISSION);
    }

    public void apply(Player player, String commandId, int cooldownSeconds, String bypassPermission) {
        if (cooldownSeconds <= 0 || hasBypass(player, bypassPermission)) {
            return;
        }
        expiresAt.put(key(player.getUniqueId(), commandId),
                System.currentTimeMillis() + (cooldownSeconds * 1000L));
    }

    private static boolean hasBypass(Player player, String bypassPermission) {
        if (player.hasPermission(BYPASS_PERMISSION)) {
            return true;
        }
        return bypassPermission != null
                && !bypassPermission.isBlank()
                && !bypassPermission.equals(BYPASS_PERMISSION)
                && player.hasPermission(bypassPermission);
    }

    public void clear(UUID uuid) {
        String prefix = uuid.toString() + ":";
        expiresAt.keySet().removeIf(k -> k.startsWith(prefix));
    }

    public void clearAll() {
        expiresAt.clear();
    }
}

package be.escapezcraft.escapezcore.database;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerQuitEvent;

/**
 * Keeps {@code minecraft_players} fresh using UUID primary identity (async writes).
 */
public final class PlayerIdentityListener implements Listener {

    private final EscapezCorePlugin plugin;
    private final DatabaseModule database;

    public PlayerIdentityListener(EscapezCorePlugin plugin, DatabaseModule database) {
        this.plugin = plugin;
        this.database = database;
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onJoin(PlayerJoinEvent event) {
        upsert(event.getPlayer().getUniqueId(), event.getPlayer().getName(), ipOf(event.getPlayer()));
    }

    @EventHandler(priority = EventPriority.MONITOR)
    public void onQuit(PlayerQuitEvent event) {
        upsert(event.getPlayer().getUniqueId(), event.getPlayer().getName(), ipOf(event.getPlayer()));
    }

    private void upsert(java.util.UUID uuid, String name, String ip) {
        MinecraftPlayerRepository repo = database.getPlayerRepository();
        if (repo == null || !database.isReady()) {
            return;
        }
        repo.upsertSeen(uuid, name, ip).whenComplete((ignored, error) -> {
            if (error != null) {
                plugin.debugLog("Player identity upsert failed: " + error.getMessage());
            }
        });
    }

    private static String ipOf(org.bukkit.entity.Player player) {
        try {
            if (player.getAddress() != null && player.getAddress().getAddress() != null) {
                return player.getAddress().getAddress().getHostAddress();
            }
        } catch (Exception ignored) {
            // ignore
        }
        return null;
    }
}

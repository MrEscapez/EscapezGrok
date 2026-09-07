package be.escapezcraft.escapezcore.staffchat;

import io.papermc.paper.event.player.AsyncChatEvent;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerQuitEvent;

/**
 * Intercepts chat when staffchat toggle is on — cancels global delivery and redirects to staff.
 */
public final class StaffChatListener implements Listener {

    private final StaffChatModule module;

    public StaffChatListener(StaffChatModule module) {
        this.module = module;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onChat(AsyncChatEvent event) {
        if (!module.isFeatureEnabled()) {
            return;
        }
        Player player = event.getPlayer();
        if (!player.hasPermission(StaffChatModule.PERMISSION)) {
            module.clearToggle(player.getUniqueId());
            return;
        }
        if (!module.isToggled(player.getUniqueId())) {
            return;
        }
        // Cancel global chat — never leak staffchat
        event.setCancelled(true);
        event.viewers().clear();
        String plain = PlainTextComponentSerializer.plainText().serialize(event.message());
        module.broadcastPlain(player, plain);
    }

    @EventHandler
    public void onQuit(PlayerQuitEvent event) {
        module.clearToggle(event.getPlayer().getUniqueId());
    }
}

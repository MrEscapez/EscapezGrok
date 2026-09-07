package be.escapezcraft.escapezcore.resourcepack;

import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.event.player.PlayerResourcePackStatusEvent;

/**
 * Join apply + Paper {@link PlayerResourcePackStatusEvent} handling with Dutch messages.
 */
public final class ResourcePackListener implements Listener {

    private final ResourcePackModule module;
    private final MessagesService messages;

    public ResourcePackListener(ResourcePackModule module, MessagesService messages) {
        this.module = module;
        this.messages = messages;
    }

    @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
    public void onJoin(PlayerJoinEvent event) {
        if (!module.isEnabled()) {
            return;
        }
        module.scheduleSend(event.getPlayer());
    }

    @EventHandler(priority = EventPriority.NORMAL, ignoreCancelled = true)
    public void onStatus(PlayerResourcePackStatusEvent event) {
        if (!module.isEnabled()) {
            return;
        }
        Player player = event.getPlayer();
        PlayerResourcePackStatusEvent.Status status = event.getStatus();
        module.getPlugin().debugLog("Resource pack status " + player.getName() + ": " + status);

        switch (status) {
            case SUCCESSFULLY_LOADED -> messages.send(player, "resourcepack-success");
            case DECLINED -> {
                messages.send(player, "resourcepack-declined");
                if (module.isRequired() && module.isKickOnDecline()) {
                    player.kick(messages.get("resourcepack-kick-declined"));
                }
            }
            case FAILED_DOWNLOAD, INVALID_URL, FAILED_RELOAD, DISCARDED -> {
                messages.send(player, "resourcepack-fail");
                if (module.isRequired() && module.isKickOnFail()) {
                    player.kick(messages.get("resourcepack-kick-failed"));
                }
            }
            case ACCEPTED, DOWNLOADED -> {
                // Intermediate — optional quiet success path; no message spam
                module.getPlugin().debugLog("Resource pack intermediate: " + status);
            }
            default -> module.getPlugin().debugLog("Onbekende resource pack status: " + status);
        }
    }
}

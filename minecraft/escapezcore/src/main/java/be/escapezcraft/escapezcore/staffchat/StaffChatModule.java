package be.escapezcraft.escapezcore.staffchat;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.serializer.plain.PlainTextComponentSerializer;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Staffchat: /sc one-shot + toggle mode. Never leaks to global chat.
 */
public final class StaffChatModule implements Module {

    public static final String PERMISSION = "escapezcore.staffchat";

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final Set<UUID> toggled = ConcurrentHashMap.newKeySet();
    private StaffChatListener listener;

    public StaffChatModule(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
    }

    @Override
    public String getName() {
        return "StaffChatModule";
    }

    @Override
    public void enable() {
        if (!configManager.getConfig().getBoolean("staffchat.enabled", true)) {
            plugin.getLogger().info("Staffchat uitgeschakeld in config.");
            return;
        }
        this.listener = new StaffChatListener(this);
        Bukkit.getPluginManager().registerEvents(listener, plugin);
        plugin.getLogger().info("Staffchat actief.");
    }

    @Override
    public void disable() {
        toggled.clear();
        // Paper does not easily unregister a single listener without PluginManager tricks;
        // listener becomes no-op when module disabled via isEnabled() checks.
        listener = null;
    }

    @Override
    public void reload() {
        // Live config reads; toggle set preserved across soft-reload.
    }

    public boolean isFeatureEnabled() {
        return configManager.getConfig().getBoolean("staffchat.enabled", true);
    }

    public boolean isToggled(UUID uuid) {
        return toggled.contains(uuid);
    }

    public boolean toggle(Player player) {
        UUID id = player.getUniqueId();
        if (toggled.contains(id)) {
            toggled.remove(id);
            return false;
        }
        toggled.add(id);
        return true;
    }

    public void clearToggle(UUID uuid) {
        toggled.remove(uuid);
    }

    /**
     * Broadcast a staffchat message to all online players with permission.
     * Never sends to global chat. Logs to console when configured.
     */
    public void broadcast(Player sender, Component adventureMessage) {
        String plain = PlainTextComponentSerializer.plainText().serialize(adventureMessage);
        broadcastPlain(sender, plain);
    }

    public void broadcastPlain(Player sender, String plainMessage) {
        if (!isFeatureEnabled()) {
            return;
        }
        String format = configManager.getConfig().getString(
                "staffchat.format",
                "<dark_gray>[</dark_gray><aqua>SC</aqua><dark_gray>]</dark_gray> "
                        + "<white>{player}</white><gray>: </gray><white>{message}</white>");
        Map<String, String> placeholders = Map.of(
                "player", sender.getName(),
                "message", plainMessage == null ? "" : plainMessage
        );
        Component rendered = messages.parse(
                MessagesService.applyBracePlaceholders(format, placeholders),
                placeholders
        );

        for (Player online : Bukkit.getOnlinePlayers()) {
            if (online.hasPermission(PERMISSION)) {
                online.sendMessage(rendered);
            }
        }

        if (configManager.getConfig().getBoolean("staffchat.log-to-console", true)) {
            plugin.getLogger().info("[StaffChat] " + sender.getName() + ": " + plainMessage);
        }
    }

    public MessagesService getMessages() {
        return messages;
    }

    public EscapezCorePlugin getPlugin() {
        return plugin;
    }
}

package be.escapezcraft.escapezcore.resourcepack;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.event.HandlerList;

import java.util.Locale;
import java.util.UUID;
import java.util.logging.Level;

/**
 * Sends a configurable server resource pack on join and reacts to Paper statuses.
 * Soft-reload safe; never invents production host URLs.
 */
public final class ResourcePackModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;

    private ResourcePackListener listener;
    private boolean enabled;
    private boolean required;
    private String url = "";
    private String sha1Hex = "";
    private byte[] sha1Bytes = new byte[0];
    private int sendDelayTicks = 20;
    private String promptRaw = "";
    private boolean kickOnDecline = true;
    private boolean kickOnFail = true;
    private UUID packUuid = UUID.nameUUIDFromBytes("escapezcraft-resourcepack".getBytes());

    public ResourcePackModule(
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
        return "ResourcePackModule";
    }

    @Override
    public void enable() {
        loadSettings();
        this.listener = new ResourcePackListener(this, messages);
        Bukkit.getPluginManager().registerEvents(listener, plugin);
        if (enabled) {
            plugin.getLogger().info("Resource pack module actief (required=" + required
                    + ", urlConfigured=" + hasUsableUrl() + ").");
        } else {
            plugin.getLogger().info("Resource pack module geladen maar uitgeschakeld (resourcepack.yml).");
        }
    }

    @Override
    public void disable() {
        if (listener != null) {
            HandlerList.unregisterAll(listener);
            listener = null;
        }
    }

    @Override
    public void reload() {
        loadSettings();
        plugin.getLogger().info("Resource pack settings herladen (enabled=" + enabled
                + ", required=" + required + ").");
    }

    private void loadSettings() {
        FileConfiguration cfg = configManager.getResourcePack();
        if (cfg == null) {
            enabled = false;
            return;
        }
        enabled = cfg.getBoolean("enabled", false);
        required = cfg.getBoolean("required", false);
        url = cfg.getString("url", "").trim();
        sha1Hex = normalizeSha1(cfg.getString("sha1", ""));
        sha1Bytes = decodeSha1(sha1Hex);
        sendDelayTicks = Math.max(0, cfg.getInt("send-delay-ticks", 20));
        promptRaw = cfg.getString("prompt", "<gray>EscapezCraft resource pack</gray>");
        kickOnDecline = cfg.getBoolean("kick-on-decline", true);
        kickOnFail = cfg.getBoolean("kick-on-fail", true);
        // Stable UUID derived from URL when present so clients can cache consistently
        String uuidSeed = url.isBlank() ? "escapezcraft-resourcepack" : url;
        packUuid = UUID.nameUUIDFromBytes(uuidSeed.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    public boolean isEnabled() {
        return enabled;
    }

    public boolean isRequired() {
        return required;
    }

    public boolean isKickOnDecline() {
        return kickOnDecline;
    }

    public boolean isKickOnFail() {
        return kickOnFail;
    }

    public int getSendDelayTicks() {
        return sendDelayTicks;
    }

    public boolean hasUsableUrl() {
        return url != null && !url.isBlank()
                && (url.startsWith("http://") || url.startsWith("https://"))
                && !url.contains("example.com");
    }

    /**
     * Schedule pack send after join delay. No-op when disabled or URL is placeholder/empty.
     */
    public void scheduleSend(Player player) {
        if (!enabled || player == null || !player.isOnline()) {
            return;
        }
        if (!hasUsableUrl()) {
            plugin.debugLog("Resource pack skip for " + player.getName()
                    + ": enabled but URL is empty/placeholder (example.com).");
            return;
        }
        long delay = sendDelayTicks;
        Bukkit.getScheduler().runTaskLater(plugin, () -> {
            if (player.isOnline()) {
                sendPack(player);
            }
        }, delay);
    }

    public void sendPack(Player player) {
        if (!enabled || !hasUsableUrl()) {
            return;
        }
        try {
            Component prompt = messages.parse(promptRaw == null ? "" : promptRaw);
            if (sha1Bytes.length == 20) {
                player.setResourcePack(packUuid, url, sha1Bytes, prompt, required);
            } else {
                // Empty hash: Paper still accepts; hash check skipped by client
                player.setResourcePack(packUuid, url, new byte[0], prompt, required);
                if (sha1Hex == null || sha1Hex.isBlank()) {
                    plugin.getLogger().warning("Resource pack SHA1 leeg — clients skippen hash-check.");
                } else {
                    plugin.getLogger().warning("Resource pack SHA1 ongeldig ('" + sha1Hex
                            + "') — verwacht 40 hex chars; hash-check overgeslagen.");
                }
            }
            messages.send(player, "resourcepack-prompt");
            plugin.debugLog("Resource pack verzonden naar " + player.getUniqueId());
        } catch (Exception ex) {
            plugin.getLogger().log(Level.WARNING, "Resource pack verzenden mislukt voor "
                    + player.getName(), ex);
            messages.send(player, "resourcepack-fail");
        }
    }

    private static String normalizeSha1(String raw) {
        if (raw == null) {
            return "";
        }
        String hex = raw.trim().toLowerCase(Locale.ROOT).replace(" ", "");
        if (hex.startsWith("sha1:")) {
            hex = hex.substring(5);
        }
        return hex;
    }

    private static byte[] decodeSha1(String hex) {
        if (hex == null || hex.length() != 40 || !hex.matches("[0-9a-f]{40}")) {
            return new byte[0];
        }
        byte[] out = new byte[20];
        for (int i = 0; i < 20; i++) {
            int idx = i * 2;
            out[i] = (byte) Integer.parseInt(hex.substring(idx, idx + 2), 16);
        }
        return out;
    }

    public EscapezCorePlugin getPlugin() {
        return plugin;
    }
}

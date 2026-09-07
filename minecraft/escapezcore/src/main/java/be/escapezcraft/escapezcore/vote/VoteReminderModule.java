package be.escapezcraft.escapezcore.vote;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitTask;

import java.util.Map;

/**
 * Periodic vote reminder using the example URL from commands.yml (never invent vote sites).
 * Complements existing {@code /vote} info command.
 */
public final class VoteReminderModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;

    private BukkitTask task;
    private boolean enabled = true;
    private int intervalSeconds = 300;
    private String permission = "";
    private boolean usePrefix = true;

    public VoteReminderModule(EscapezCorePlugin plugin, ConfigManager configManager, MessagesService messages) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
    }

    @Override
    public String getName() {
        return "VoteReminderModule";
    }

    @Override
    public void enable() {
        loadAndSchedule();
    }

    @Override
    public void disable() {
        cancelTask();
    }

    @Override
    public void reload() {
        loadAndSchedule();
    }

    private void loadAndSchedule() {
        cancelTask();
        FileConfiguration cfg = configManager.getScoreboard();
        ConfigurationSection section = cfg == null ? null : cfg.getConfigurationSection("vote-reminder");
        if (section == null) {
            enabled = false;
            plugin.getLogger().info("Vote-reminder: geen sectie in scoreboard.yml.");
            return;
        }
        enabled = section.getBoolean("enabled", true);
        intervalSeconds = Math.max(30, section.getInt("interval-seconds", 300));
        permission = section.getString("permission", "");
        usePrefix = section.getBoolean("use-prefix", true);

        if (!enabled) {
            plugin.getLogger().info("Vote-reminder uitgeschakeld.");
            return;
        }
        long ticks = intervalSeconds * 20L;
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::broadcast, ticks, ticks);
        plugin.getLogger().info("Vote-reminder actief (interval=" + intervalSeconds + "s).");
    }

    private void cancelTask() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    private void broadcast() {
        if (!enabled) {
            return;
        }
        String url = resolveVoteUrl();
        Map<String, String> placeholders = Map.of("url", url);
        Component body = messages.get("vote-reminder", placeholders);
        Component message = usePrefix
                ? messages.parse(messages.getPrefixRaw()).append(body)
                : body;

        for (Player player : Bukkit.getOnlinePlayers()) {
            if (permission != null && !permission.isBlank() && !player.hasPermission(permission)) {
                continue;
            }
            player.sendMessage(message);
        }
    }

    /**
     * Reads example URL from commands.yml {@code vote.url} — do not invent third-party vote sites.
     */
    private String resolveVoteUrl() {
        FileConfiguration commands = configManager.getCommands();
        if (commands != null) {
            String url = commands.getString("vote.url");
            if (url != null && !url.isBlank()) {
                return url;
            }
        }
        return "https://example.com/vote";
    }
}

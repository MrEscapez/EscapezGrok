package be.escapezcraft.escapezcore.tips;

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

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Broadcasts configurable Dutch MiniMessage tips on an interval.
 */
public final class TipsModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;

    private BukkitTask task;
    private boolean enabled = true;
    private int intervalSeconds = 180;
    private String mode = "random";
    private String permission = "";
    private boolean usePrefix = true;
    private List<String> tipMessages = List.of();
    private final AtomicInteger sequentialIndex = new AtomicInteger(0);

    public TipsModule(EscapezCorePlugin plugin, ConfigManager configManager, MessagesService messages) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
    }

    @Override
    public String getName() {
        return "TipsModule";
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
        ConfigurationSection section = cfg == null ? null : cfg.getConfigurationSection("tips");
        if (section == null) {
            enabled = false;
            tipMessages = List.of();
            plugin.getLogger().info("Tips: geen tips-sectie in scoreboard.yml.");
            return;
        }
        enabled = section.getBoolean("enabled", true);
        intervalSeconds = Math.max(10, section.getInt("interval-seconds", 180));
        mode = section.getString("mode", "random").toLowerCase();
        permission = section.getString("permission", "");
        usePrefix = section.getBoolean("use-prefix", true);
        tipMessages = new ArrayList<>(section.getStringList("messages"));
        sequentialIndex.set(0);

        if (!enabled || tipMessages.isEmpty()) {
            plugin.getLogger().info("Tips uitgeschakeld of geen berichten.");
            return;
        }
        long ticks = intervalSeconds * 20L;
        task = Bukkit.getScheduler().runTaskTimer(plugin, this::broadcastNext, ticks, ticks);
        plugin.getLogger().info("Tips actief (interval=" + intervalSeconds + "s, mode=" + mode
                + ", count=" + tipMessages.size() + ").");
    }

    private void cancelTask() {
        if (task != null) {
            task.cancel();
            task = null;
        }
    }

    private void broadcastNext() {
        if (!enabled || tipMessages.isEmpty()) {
            return;
        }
        String raw;
        if ("sequential".equals(mode)) {
            int idx = Math.floorMod(sequentialIndex.getAndIncrement(), tipMessages.size());
            raw = tipMessages.get(idx);
        } else {
            raw = tipMessages.get(ThreadLocalRandom.current().nextInt(tipMessages.size()));
        }
        if (raw == null || raw.isBlank()) {
            return;
        }
        Component body = messages.parse(raw);
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
}

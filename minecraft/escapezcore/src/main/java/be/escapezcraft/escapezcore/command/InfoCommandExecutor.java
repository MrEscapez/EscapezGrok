package be.escapezcraft.escapezcore.command;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Handles /discord /website /vote /shop /regels /staff from commands.yml.
 */
public final class InfoCommandExecutor implements CommandExecutor, TabCompleter {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final CooldownService cooldowns;
    private final String commandKey;

    public InfoCommandExecutor(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            CooldownService cooldowns,
            String commandKey
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.cooldowns = cooldowns;
        this.commandKey = commandKey;
    }

    @Override
    public boolean onCommand(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String label,
            @NotNull String[] args
    ) {
        ConfigurationSection section = configManager.getCommands().getConfigurationSection(commandKey);
        if (section == null || !section.getBoolean("enabled", true)) {
            messages.send(sender, "unknown-subcommand");
            return true;
        }

        String permission = section.getString("permission", "escapezcore.command." + commandKey);
        if (!sender.hasPermission(permission)) {
            messages.send(sender, "no-permission");
            return true;
        }

        int cooldown = section.getInt("cooldown-seconds",
                configManager.getConfig().getInt("cooldowns.info-commands-seconds", 5));

        if (sender instanceof Player player) {
            int remaining = cooldowns.remainingSeconds(player, commandKey, cooldown);
            if (remaining > 0) {
                messages.send(sender, "cooldown", Map.of("seconds", String.valueOf(remaining)));
                return true;
            }
            cooldowns.apply(player, commandKey, cooldown);
        }

        String url = section.getString("url", "https://example.com");
        String messageKey = section.getString("message-key", "info-" + commandKey);
        messages.send(sender, messageKey, Map.of("url", url));
        plugin.debugLog("Info command executed: " + commandKey + " by "
                + (sender instanceof Player p ? p.getUniqueId().toString() : "console"));
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String alias,
            @NotNull String[] args
    ) {
        return Collections.emptyList();
    }
}

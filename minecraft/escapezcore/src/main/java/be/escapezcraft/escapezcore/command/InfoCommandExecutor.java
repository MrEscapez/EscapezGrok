package be.escapezcraft.escapezcore.command;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.event.ClickEvent;
import net.kyori.adventure.text.event.HoverEvent;
import net.kyori.adventure.text.format.NamedTextColor;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * Handles configurable info commands (/discord /website /vote /shop /regels /staff)
 * from commands.yml — permissions, cooldown, console/player rules, logging, click URL.
 */
public final class InfoCommandExecutor implements CommandExecutor, TabCompleter {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final CooldownService cooldowns;
    private final CommandModule commandModule;
    private final String commandKey;

    public InfoCommandExecutor(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            CooldownService cooldowns,
            CommandModule commandModule,
            String commandKey
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.cooldowns = cooldowns;
        this.commandModule = commandModule;
        this.commandKey = commandKey;
    }

    @Override
    public boolean onCommand(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String label,
            @NotNull String[] args
    ) {
        CommandDefinition def = commandModule.getDefinition(commandKey);
        if (def == null || !def.enabled()) {
            messages.send(sender, "unknown-subcommand");
            return true;
        }

        if (!sender.hasPermission(def.permission())) {
            messages.send(sender, "no-permission");
            return true;
        }

        if (sender instanceof Player) {
            // players always allowed when enabled + permission
        } else {
            if (def.playerOnly() || !def.consoleAllowed()) {
                messages.send(sender, "player-only");
                return true;
            }
        }

        if (sender instanceof Player player) {
            int remaining = cooldowns.remainingSeconds(
                    player, commandKey, def.cooldownSeconds(), def.cooldownBypass());
            if (remaining > 0) {
                messages.send(sender, "cooldown", Map.of("seconds", String.valueOf(remaining)));
                return true;
            }
            cooldowns.apply(player, commandKey, def.cooldownSeconds(), def.cooldownBypass());
        }

        String url = def.url() == null ? "https://example.com" : def.url();
        messages.send(sender, def.messageKey(), Map.of("url", url));

        // Optional extra clickable line when message has no click (fallback)
        if ("suggest_command".equalsIgnoreCase(def.clickAction()) && sender instanceof Player) {
            Component hint = Component.text("→ /" + commandKey, NamedTextColor.DARK_AQUA)
                    .clickEvent(ClickEvent.suggestCommand("/" + commandKey))
                    .hoverEvent(HoverEvent.showText(Component.text("Klik om in te vullen", NamedTextColor.GRAY)));
            sender.sendMessage(hint);
        }

        if (def.logging()) {
            String who = sender instanceof Player p ? p.getUniqueId().toString() : "console";
            plugin.debugLog("Info command executed: " + commandKey + " by " + who + " (label=" + label + ")");
        }
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String alias,
            @NotNull String[] args
    ) {
        // Info commands take no args — never leak admin suggestions
        return Collections.emptyList();
    }
}

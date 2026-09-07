package be.escapezcraft.escapezcore.command;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.Material;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * /ec — opens GUI; /ec help permission-filtered + clickable; /ec admin fully hidden without escapezcore.admin.
 */
public final class EscapezCommand implements CommandExecutor, TabCompleter {

    public static final String ADMIN_PERMISSION = "escapezcore.admin";
    public static final String EC_PERMISSION = "escapezcore.command.ec";

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final GuiModule guiModule;
    private final CooldownService cooldowns;
    private final CommandModule commandModule;

    public EscapezCommand(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            GuiModule guiModule,
            CooldownService cooldowns,
            CommandModule commandModule
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.guiModule = guiModule;
        this.cooldowns = cooldowns;
        this.commandModule = commandModule;
    }

    @Override
    public boolean onCommand(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String label,
            @NotNull String[] args
    ) {
        if (!sender.hasPermission(EC_PERMISSION)) {
            messages.send(sender, "no-permission");
            return true;
        }

        if (args.length == 0) {
            if (sender instanceof Player player) {
                if (configManager.getConfig().getBoolean("gui.open-on-ec", true)) {
                    guiModule.openMain(player);
                    messages.send(player, "gui-opened");
                } else {
                    sendHelp(sender);
                }
            } else {
                sendHelp(sender);
            }
            return true;
        }

        String sub = args[0].toLowerCase(Locale.ROOT);

        // Admin branch is FULLY HIDDEN without permission — no help, no tab, no leak
        if (sub.equals("admin")) {
            if (!sender.hasPermission(ADMIN_PERMISSION)) {
                messages.send(sender, "unknown-subcommand");
                return true;
            }
            return handleAdmin(sender, Arrays.copyOfRange(args, 1, args.length));
        }

        if (sub.equals("help")) {
            sendHelp(sender);
            return true;
        }

        messages.send(sender, "unknown-subcommand");
        return true;
    }

    private boolean handleAdmin(CommandSender sender, String[] args) {
        if (args.length == 0) {
            if (sender instanceof Player player && sender.hasPermission("escapezcore.admin.gui")) {
                guiModule.openAdmin(player);
                return true;
            }
            sender.sendMessage(messages.parse("<gray>/ec admin <reload|gui|item|debug></gray>"));
            return true;
        }

        String action = args[0].toLowerCase(Locale.ROOT);
        switch (action) {
            case "reload" -> {
                if (!sender.hasPermission("escapezcore.admin.reload")) {
                    messages.send(sender, "no-permission");
                    return true;
                }
                try {
                    plugin.softReload();
                    messages.send(sender, "reload-success");
                } catch (Exception ex) {
                    messages.send(sender, "reload-failed", Map.of(
                            "error", ex.getMessage() == null ? "unknown" : ex.getMessage()));
                }
            }
            case "gui" -> {
                if (!(sender instanceof Player player)) {
                    messages.send(sender, "player-only");
                    return true;
                }
                if (!sender.hasPermission("escapezcore.admin.gui")) {
                    messages.send(sender, "no-permission");
                    return true;
                }
                guiModule.openAdmin(player);
            }
            case "item" -> {
                if (!(sender instanceof Player player)) {
                    messages.send(sender, "player-only");
                    return true;
                }
                if (!sender.hasPermission(ADMIN_PERMISSION)) {
                    messages.send(sender, "no-permission");
                    return true;
                }
                var hand = player.getInventory().getItemInMainHand();
                if (hand.getType() == Material.AIR) {
                    messages.send(sender, "no-item");
                    return true;
                }
                messages.send(sender, "item-info", Map.of("material", hand.getType().name()));
            }
            case "debug" -> {
                if (!sender.hasPermission(ADMIN_PERMISSION)) {
                    messages.send(sender, "no-permission");
                    return true;
                }
                boolean next = !plugin.isDebug();
                plugin.setDebug(next);
                messages.send(sender, "debug-enabled", Map.of("state", next ? "aan" : "uit"));
            }
            default -> sender.sendMessage(messages.parse("<gray>/ec admin <reload|gui|item|debug></gray>"));
        }
        return true;
    }

    private void sendHelp(CommandSender sender) {
        messages.sendRaw(sender, "help-header");
        List<HelpEntry> entries = new ArrayList<>();
        entries.add(new HelpEntry("ec", "Open het EscapezCore menu", EC_PERMISSION));
        entries.add(new HelpEntry("ec help", "Toon deze help", EC_PERMISSION));

        for (CommandDefinition def : commandModule.getDefinitions()) {
            if (!def.enabled() || def.hidden()) {
                continue;
            }
            entries.add(new HelpEntry(def.key(), def.description(), def.permission()));
        }

        // Admin help ONLY if permitted — never leak otherwise
        if (sender.hasPermission(ADMIN_PERMISSION)) {
            entries.add(new HelpEntry("ec admin", "Admin-tools (reload, gui, item, debug)", ADMIN_PERMISSION));
        }

        boolean any = false;
        for (HelpEntry entry : entries) {
            if (!sender.hasPermission(entry.permission())) {
                continue;
            }
            any = true;
            // Placeholders {command}/{description} are brace-substituted in MessagesService
            messages.sendRaw(sender, "help-line", Map.of(
                    "command", entry.command(),
                    "description", entry.description()
            ));
        }
        if (!any) {
            messages.sendRaw(sender, "help-empty");
        }
    }

    @Override
    public @Nullable List<String> onTabComplete(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String alias,
            @NotNull String[] args
    ) {
        if (!sender.hasPermission(EC_PERMISSION)) {
            return Collections.emptyList();
        }

        if (args.length == 1) {
            List<String> opts = new ArrayList<>();
            opts.add("help");
            // admin ONLY suggested with permission — fully hidden otherwise
            if (sender.hasPermission(ADMIN_PERMISSION)) {
                opts.add("admin");
            }
            String prefix = args[0].toLowerCase(Locale.ROOT);
            return opts.stream().filter(s -> s.startsWith(prefix)).collect(Collectors.toList());
        }

        if (args.length == 2 && args[0].equalsIgnoreCase("admin")) {
            if (!sender.hasPermission(ADMIN_PERMISSION)) {
                return Collections.emptyList();
            }
            List<String> adminOpts = new ArrayList<>();
            if (sender.hasPermission("escapezcore.admin.reload")) {
                adminOpts.add("reload");
            }
            if (sender.hasPermission("escapezcore.admin.gui")) {
                adminOpts.add("gui");
            }
            if (sender.hasPermission(ADMIN_PERMISSION)) {
                adminOpts.add("item");
                adminOpts.add("debug");
            }
            String prefix = args[1].toLowerCase(Locale.ROOT);
            return adminOpts.stream().filter(s -> s.startsWith(prefix)).sorted().collect(Collectors.toList());
        }

        return Collections.emptyList();
    }

    private record HelpEntry(String command, String description, String permission) {
    }
}

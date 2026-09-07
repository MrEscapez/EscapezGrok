package be.escapezcraft.escapezcore.command;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.items.ItemAdminCommands;
import be.escapezcraft.escapezcore.items.ItemsModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.report.ReportCommand;
import be.escapezcraft.escapezcore.report.ReportStaffCommands;
import be.escapezcraft.escapezcore.scoreboard.ScoreboardCommand;
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
    private ReportCommand reportCommand;
    private ReportStaffCommands reportStaffCommands;
    private ScoreboardCommand scoreboardCommand;
    private ItemsModule itemsModule;

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

    public void setReportHandlers(ReportCommand reportCommand, ReportStaffCommands reportStaffCommands) {
        this.reportCommand = reportCommand;
        this.reportStaffCommands = reportStaffCommands;
    }

    public void setScoreboardHandler(ScoreboardCommand scoreboardCommand) {
        this.scoreboardCommand = scoreboardCommand;
    }

    public void setItemsModule(ItemsModule itemsModule) {
        this.itemsModule = itemsModule;
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

        if (sub.equals("report")) {
            if (reportCommand == null) {
                messages.send(sender, "report-disabled");
                return true;
            }
            return reportCommand.handle(sender, Arrays.copyOfRange(args, 1, args.length));
        }

        if (sub.equals("scoreboard") || sub.equals("sb")) {
            if (scoreboardCommand == null) {
                messages.send(sender, "scoreboard-disabled");
                return true;
            }
            return scoreboardCommand.handle(sender);
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
            sender.sendMessage(messages.parse("<gray>/ec admin <reload|gui|item|debug|report></gray>"));
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
                // Editor skeleton + open admin / inspect menus
                if (!sender.hasPermission("escapezcore.admin.gui")) {
                    messages.send(sender, "no-permission");
                    return true;
                }
                String[] guiArgs = Arrays.copyOfRange(args, 1, args.length);
                return guiModule.getEditor().handle(sender, guiArgs);
            }
            case "item" -> {
                if (!sender.hasPermission(ADMIN_PERMISSION)
                        && !sender.hasPermission(ItemAdminCommands.PERM_ITEM)) {
                    messages.send(sender, "no-permission");
                    return true;
                }
                if (itemsModule == null || itemsModule.getAdminCommands() == null) {
                    messages.send(sender, "items-disabled");
                    return true;
                }
                return itemsModule.getAdminCommands().handle(
                        sender, Arrays.copyOfRange(args, 1, args.length));
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
            case "report" -> {
                if (!sender.hasPermission(ADMIN_PERMISSION)) {
                    messages.send(sender, "no-permission");
                    return true;
                }
                if (reportStaffCommands == null) {
                    messages.send(sender, "report-disabled");
                    return true;
                }
                return reportStaffCommands.handle(sender, Arrays.copyOfRange(args, 1, args.length));
            }
            default -> sender.sendMessage(messages.parse("<gray>/ec admin <reload|gui|item|debug|report></gray>"));
        }
        return true;
    }

    private void sendHelp(CommandSender sender) {
        messages.sendRaw(sender, "help-header");
        List<HelpEntry> entries = new ArrayList<>();
        entries.add(new HelpEntry("ec", "Open het EscapezCore menu", EC_PERMISSION));
        entries.add(new HelpEntry("ec help", "Toon deze help", EC_PERMISSION));
        entries.add(new HelpEntry("ec report", "Meld een speler", "escapezcore.command.report"));
        entries.add(new HelpEntry("report", "Meld een speler", "escapezcore.command.report"));
        entries.add(new HelpEntry("ec scoreboard", "Scoreboard aan/uit", "escapezcore.scoreboard.toggle"));
        entries.add(new HelpEntry("sb", "Scoreboard aan/uit", "escapezcore.scoreboard.toggle"));
        entries.add(new HelpEntry("sc", "Staffchat (toggle of bericht)", "escapezcore.staffchat"));
        entries.add(new HelpEntry("reports", "Beheer meldingen", "escapezcore.report.manage"));

        for (CommandDefinition def : commandModule.getDefinitions()) {
            if (!def.enabled() || def.hidden()) {
                continue;
            }
            // Avoid duplicating report/sc if already listed
            if (def.key().equals("report") || def.key().equals("sc") || def.key().equals("reports")) {
                continue;
            }
            entries.add(new HelpEntry(def.key(), def.description(), def.permission()));
        }

        // Admin help ONLY if permitted — never leak otherwise
        if (sender.hasPermission(ADMIN_PERMISSION)) {
            entries.add(new HelpEntry("ec admin", "Admin-tools (reload, gui, item, debug, report)", ADMIN_PERMISSION));
            entries.add(new HelpEntry("ec admin item", "Custom items (list/info/give/get/gui)", ItemAdminCommands.PERM_ITEM));
            entries.add(new HelpEntry("ec admin gui", "GUI editor skeleton (list/open/save)", "escapezcore.admin.gui"));
            entries.add(new HelpEntry("ec admin report", "Report-beheer (list/view/claim/…)", ADMIN_PERMISSION));
        }

        boolean any = false;
        for (HelpEntry entry : entries) {
            if (!sender.hasPermission(entry.permission())) {
                continue;
            }
            any = true;
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
            if (sender.hasPermission("escapezcore.command.report")) {
                opts.add("report");
            }
            if (sender.hasPermission("escapezcore.scoreboard.toggle")) {
                opts.add("scoreboard");
            }
            if (sender.hasPermission(ADMIN_PERMISSION)) {
                opts.add("admin");
            }
            String prefix = args[0].toLowerCase(Locale.ROOT);
            return opts.stream().filter(s -> s.startsWith(prefix)).collect(Collectors.toList());
        }

        if (args[0].equalsIgnoreCase("report") && reportCommand != null) {
            return reportCommand.tabComplete(sender, Arrays.copyOfRange(args, 1, args.length));
        }

        if (!args[0].equalsIgnoreCase("admin") || !sender.hasPermission(ADMIN_PERMISSION)) {
            return Collections.emptyList();
        }

        if (args.length == 2) {
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
                adminOpts.add("report");
            }
            String prefix = args[1].toLowerCase(Locale.ROOT);
            return adminOpts.stream().filter(s -> s.startsWith(prefix)).sorted().collect(Collectors.toList());
        }

        // /ec admin gui <...>
        if (args.length >= 3 && args[1].equalsIgnoreCase("gui")
                && sender.hasPermission("escapezcore.admin.gui")) {
            String[] guiArgs = Arrays.copyOfRange(args, 2, args.length);
            return guiModule.getEditor().tabComplete(sender, guiArgs);
        }

        // /ec admin report <...>
        if (args.length >= 3 && args[1].equalsIgnoreCase("report") && reportStaffCommands != null) {
            return reportStaffCommands.tabComplete(sender, Arrays.copyOfRange(args, 2, args.length));
        }

        // /ec admin item <...>
        if (args.length >= 3 && args[1].equalsIgnoreCase("item")
                && itemsModule != null && itemsModule.getAdminCommands() != null) {
            return itemsModule.getAdminCommands().tabComplete(
                    sender, Arrays.copyOfRange(args, 2, args.length));
        }

        return Collections.emptyList();
    }

    private record HelpEntry(String command, String description, String permission) {
    }
}

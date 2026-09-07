package be.escapezcraft.escapezcore.command;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.items.ItemsModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import be.escapezcraft.escapezcore.report.ReportCommand;
import be.escapezcraft.escapezcore.report.ReportModule;
import be.escapezcraft.escapezcore.report.ReportStaffCommands;
import be.escapezcraft.escapezcore.scoreboard.ScoreboardCommand;
import be.escapezcraft.escapezcore.scoreboard.ScoreboardModule;
import be.escapezcraft.escapezcore.staffchat.StaffChatCommand;
import be.escapezcraft.escapezcore.staffchat.StaffChatModule;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandMap;
import org.bukkit.command.PluginCommand;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.logging.Level;

/**
 * Registers /ec and info commands; loads commands.yml definitions;
 * syncs aliases.yml (+ per-command aliases) onto the server command map where possible.
 */
public final class CommandModule implements Module {

    private static final String[] INFO_COMMANDS = {
            "discord", "website", "vote", "shop", "regels", "staff"
    };

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final GuiModule guiModule;
    private final CooldownService cooldownService = new CooldownService();
    private final Map<String, CommandDefinition> definitions = new LinkedHashMap<>();
    private EscapezCommand escapezCommand;
    private ReportModule reportModule;
    private StaffChatModule staffChatModule;
    private ScoreboardModule scoreboardModule;
    private ItemsModule itemsModule;
    private ReportCommand reportCommand;
    private ReportStaffCommands reportStaffCommands;
    private StaffChatCommand staffChatCommand;
    private ScoreboardCommand scoreboardCommand;

    public CommandModule(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            GuiModule guiModule
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.guiModule = guiModule;
    }

    /**
     * Called once after feature modules are constructed.
     */
    public void wireFeatureModules(
            ReportModule reportModule,
            StaffChatModule staffChatModule,
            ScoreboardModule scoreboardModule,
            ItemsModule itemsModule
    ) {
        this.reportModule = reportModule;
        this.staffChatModule = staffChatModule;
        this.scoreboardModule = scoreboardModule;
        this.itemsModule = itemsModule;
    }

    @Override
    public String getName() {
        return "CommandModule";
    }

    @Override
    public void enable() {
        reloadDefinitions();
        this.escapezCommand = new EscapezCommand(
                plugin, configManager, messages, guiModule, cooldownService, this);
        bind("ec", escapezCommand, escapezCommand);

        for (String key : INFO_COMMANDS) {
            InfoCommandExecutor executor = new InfoCommandExecutor(
                    plugin, configManager, messages, cooldownService, this, key);
            bind(key, executor, executor);
        }

        if (reportModule != null) {
            this.reportCommand = new ReportCommand(plugin, messages, reportModule.getService());
            this.reportStaffCommands = new ReportStaffCommands(plugin, messages, reportModule.getService());
            bind("report", reportCommand, reportCommand);
            bind("reports", reportStaffCommands, reportStaffCommands);
            escapezCommand.setReportHandlers(reportCommand, reportStaffCommands);
        }

        if (staffChatModule != null) {
            this.staffChatCommand = new StaffChatCommand(staffChatModule, messages);
            bind("sc", staffChatCommand, staffChatCommand);
        }

        if (scoreboardModule != null) {
            this.scoreboardCommand = scoreboardModule.getCommand();
            if (scoreboardCommand != null) {
                bind("sb", scoreboardCommand, scoreboardCommand);
            }
            escapezCommand.setScoreboardHandler(scoreboardCommand);
        }

        if (itemsModule != null) {
            escapezCommand.setItemsModule(itemsModule);
        }

        syncAliases();
        plugin.getLogger().info("Commands registered (" + definitions.size()
                + " definitions). Aliases synced from aliases.yml / commands.yml.");
    }

    private void bind(String name, org.bukkit.command.CommandExecutor executor,
                      org.bukkit.command.TabCompleter tabCompleter) {
        PluginCommand cmd = plugin.getCommand(name);
        if (cmd == null) {
            plugin.getLogger().warning("Command not in plugin.yml: " + name);
            return;
        }
        cmd.setExecutor(executor);
        cmd.setTabCompleter(tabCompleter);

        CommandDefinition def = definitions.get(name);
        if (def != null) {
            if (def.permission() != null && !def.permission().isBlank()) {
                cmd.setPermission(def.permission());
            }
            if (def.description() != null) {
                cmd.setDescription(def.description());
            }
        }
    }

    /**
     * Rebuild CommandDefinition cache from commands.yml.
     */
    public void reloadDefinitions() {
        definitions.clear();
        FileConfiguration commands = configManager.getCommands();
        int defaultCooldown = configManager.getConfig().getInt("cooldowns.info-commands-seconds", 5);
        if (commands == null) {
            return;
        }
        for (String key : commands.getKeys(false)) {
            ConfigurationSection section = commands.getConfigurationSection(key);
            if (section == null) {
                continue;
            }
            CommandDefinition def = CommandDefinition.from(key, section, defaultCooldown);
            definitions.put(def.key(), def);
        }
    }

    /**
     * Sync aliases from aliases.yml and commands.yml onto PluginCommand + CommandMap.
     * New aliases after first enable may require a soft-reload; plugin.yml aliases
     * remain the hard registration source for cold start.
     */
    public void syncAliases() {
        Map<String, List<String>> aliasToTargets = new LinkedHashMap<>();

        // aliases.yml: alias -> target
        FileConfiguration aliasesFile = configManager.getAliases();
        if (aliasesFile != null) {
            for (String alias : aliasesFile.getKeys(false)) {
                String target = aliasesFile.getString(alias);
                if (target == null || target.isBlank()) {
                    continue;
                }
                aliasToTargets.computeIfAbsent(target.toLowerCase(Locale.ROOT), t -> new ArrayList<>())
                        .add(alias.toLowerCase(Locale.ROOT));
            }
        }

        // commands.yml aliases:[]
        for (CommandDefinition def : definitions.values()) {
            for (String alias : def.aliases()) {
                if (alias == null || alias.isBlank()) {
                    continue;
                }
                aliasToTargets.computeIfAbsent(def.key(), t -> new ArrayList<>())
                        .add(alias.toLowerCase(Locale.ROOT));
            }
        }

        CommandMap commandMap = Bukkit.getServer().getCommandMap();
        Map<String, Command> known = commandMap.getKnownCommands();

        for (Map.Entry<String, List<String>> entry : aliasToTargets.entrySet()) {
            String target = entry.getKey();
            PluginCommand cmd = plugin.getCommand(target);
            if (cmd == null) {
                plugin.getLogger().warning("Alias target not found in plugin.yml: " + target);
                continue;
            }

            List<String> merged = new ArrayList<>(cmd.getAliases());
            for (String alias : entry.getValue()) {
                if (!merged.contains(alias) && !alias.equalsIgnoreCase(cmd.getName())) {
                    merged.add(alias);
                }
            }
            cmd.setAliases(merged);

            String pluginPrefix = plugin.getName().toLowerCase(Locale.ROOT);
            for (String alias : merged) {
                known.put(alias.toLowerCase(Locale.ROOT), cmd);
                known.put(pluginPrefix + ":" + alias.toLowerCase(Locale.ROOT), cmd);
            }
            // Ensure primary name stays mapped
            known.put(cmd.getName().toLowerCase(Locale.ROOT), cmd);
            known.put(pluginPrefix + ":" + cmd.getName().toLowerCase(Locale.ROOT), cmd);
        }
    }

    @Override
    public void disable() {
        cooldownService.clearAll();
        definitions.clear();
    }

    @Override
    public void reload() {
        try {
            reloadDefinitions();
            syncAliases();
            // Re-apply permission/description from definitions onto bound commands
            for (String key : INFO_COMMANDS) {
                PluginCommand cmd = plugin.getCommand(key);
                CommandDefinition def = definitions.get(key);
                if (cmd != null && def != null) {
                    if (def.permission() != null) {
                        cmd.setPermission(def.permission());
                    }
                    if (def.description() != null) {
                        cmd.setDescription(def.description());
                    }
                }
            }
            plugin.getLogger().info("Command definitions herladen uit commands.yml / aliases.yml ("
                    + definitions.size() + ").");
        } catch (Exception ex) {
            plugin.getLogger().log(Level.WARNING, "CommandModule reload mislukt", ex);
            throw ex;
        }
    }

    public CooldownService getCooldownService() {
        return cooldownService;
    }

    public EscapezCommand getEscapezCommand() {
        return escapezCommand;
    }

    public ReportCommand getReportCommand() {
        return reportCommand;
    }

    public ReportStaffCommands getReportStaffCommands() {
        return reportStaffCommands;
    }

    public ScoreboardCommand getScoreboardCommand() {
        return scoreboardCommand;
    }

    public ItemsModule getItemsModule() {
        return itemsModule;
    }

    public CommandDefinition getDefinition(String key) {
        if (key == null) {
            return null;
        }
        return definitions.get(key.toLowerCase(Locale.ROOT));
    }

    public Collection<CommandDefinition> getDefinitions() {
        return Collections.unmodifiableCollection(definitions.values());
    }

    /**
     * Resolve aliases.yml mapping (alias -> target command name).
     */
    public String resolveAlias(String input) {
        if (input == null) {
            return null;
        }
        String lower = input.toLowerCase(Locale.ROOT);
        if (configManager.getAliases().contains(lower)) {
            return configManager.getAliases().getString(lower, lower);
        }
        for (CommandDefinition def : definitions.values()) {
            if (def.key().equals(lower)) {
                return def.key();
            }
            for (String alias : def.aliases()) {
                if (alias.equalsIgnoreCase(lower)) {
                    return def.key();
                }
            }
        }
        return lower;
    }
}

package be.escapezcraft.escapezcore.command;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import org.bukkit.command.PluginCommand;

/**
 * Registers /ec and info commands; loads aliases.yml for lookup.
 */
public final class CommandModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final GuiModule guiModule;
    private final CooldownService cooldownService = new CooldownService();
    private EscapezCommand escapezCommand;

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

    @Override
    public String getName() {
        return "CommandModule";
    }

    @Override
    public void enable() {
        this.escapezCommand = new EscapezCommand(plugin, configManager, messages, guiModule, cooldownService);
        bind("ec", escapezCommand, escapezCommand);

        String[] infoCmds = {"discord", "website", "vote", "shop", "regels", "staff"};
        for (String key : infoCmds) {
            InfoCommandExecutor executor = new InfoCommandExecutor(
                    plugin, configManager, messages, cooldownService, key);
            bind(key, executor, executor);
        }

        plugin.getLogger().info("Commands registered. Aliases from aliases.yml: "
                + configManager.getAliases().getKeys(false));
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
    }

    @Override
    public void disable() {
        cooldownService.clearAll();
    }

    @Override
    public void reload() {
        // Soft reload: configs already refreshed by ConfigManager; cooldowns kept
        plugin.getLogger().info("Command definitions herladen uit commands.yml / aliases.yml.");
    }

    public CooldownService getCooldownService() {
        return cooldownService;
    }

    public EscapezCommand getEscapezCommand() {
        return escapezCommand;
    }

    /**
     * Resolve aliases.yml mapping (alias -> target command name).
     */
    public String resolveAlias(String input) {
        if (input == null) {
            return null;
        }
        String lower = input.toLowerCase();
        if (configManager.getAliases().contains(lower)) {
            return configManager.getAliases().getString(lower, lower);
        }
        return lower;
    }
}

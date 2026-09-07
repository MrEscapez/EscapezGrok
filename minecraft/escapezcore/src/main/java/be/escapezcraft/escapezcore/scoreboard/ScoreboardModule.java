package be.escapezcraft.escapezcore.scoreboard;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.database.DatabaseModule;
import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import org.bukkit.Bukkit;

/**
 * FASE 7 scoreboard module — no-flicker sidebar + player toggle.
 */
public final class ScoreboardModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final HookManager hookManager;
    private final DatabaseModule databaseModule;

    private PlaceholderResolver placeholders;
    private ScoreboardService service;
    private ScoreboardListener listener;
    private ScoreboardCommand command;

    public ScoreboardModule(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            HookManager hookManager,
            DatabaseModule databaseModule
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.hookManager = hookManager;
        this.databaseModule = databaseModule;
    }

    @Override
    public String getName() {
        return "ScoreboardModule";
    }

    @Override
    public void enable() {
        this.placeholders = new PlaceholderResolver(hookManager);
        this.service = new ScoreboardService(plugin, configManager, messages, placeholders, databaseModule);
        this.listener = new ScoreboardListener(service);
        this.command = new ScoreboardCommand(this, messages);
        Bukkit.getPluginManager().registerEvents(listener, plugin);
        service.start();
    }

    @Override
    public void disable() {
        if (service != null) {
            service.stop();
            service.clearVisibilityCache();
        }
        listener = null;
        command = null;
    }

    @Override
    public void reload() {
        if (placeholders != null) {
            placeholders.refresh();
        }
        if (service != null) {
            service.reload();
        }
    }

    public ScoreboardService getService() {
        return service;
    }

    public ScoreboardCommand getCommand() {
        return command;
    }
}

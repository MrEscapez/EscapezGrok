package be.escapezcraft.escapezcore;

import be.escapezcraft.escapezcore.command.CommandModule;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.database.DatabaseModule;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.ModuleManager;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * EscapezCore main entry — bootstraps ModuleManager and core modules.
 */
public final class EscapezCorePlugin extends JavaPlugin {

    private ModuleManager moduleManager;
    private ConfigManager configManager;
    private MessagesService messagesService;
    private HookManager hookManager;
    private DatabaseModule databaseModule;
    private CommandModule commandModule;
    private GuiModule guiModule;
    private boolean debug;

    @Override
    public void onEnable() {
        this.moduleManager = new ModuleManager(this);

        this.configManager = new ConfigManager(this);
        this.messagesService = new MessagesService(this, configManager);
        this.hookManager = new HookManager(this);
        this.databaseModule = new DatabaseModule(this, configManager);
        this.guiModule = new GuiModule(this, configManager, messagesService, hookManager);
        this.commandModule = new CommandModule(this, configManager, messagesService, guiModule);

        moduleManager.register(configManager);
        moduleManager.register(messagesService);
        moduleManager.register(hookManager);
        moduleManager.register(databaseModule);
        moduleManager.register(guiModule);
        moduleManager.register(commandModule);

        moduleManager.enableAll();

        this.debug = configManager.getConfig().getBoolean("debug", false);
        getLogger().info("EscapezCore " + getPluginMeta().getVersion() + " enabled.");
    }

    @Override
    public void onDisable() {
        if (moduleManager != null) {
            moduleManager.disableAll();
        }
        getLogger().info("EscapezCore disabled.");
    }

    /**
     * Safe soft-reload: messages, commands, aliases, gui, config — never Bukkit.reload().
     */
    public void softReload() throws Exception {
        moduleManager.reloadSafe();
        this.debug = configManager.getConfig().getBoolean("debug", false);
    }

    public ModuleManager getModuleManager() {
        return moduleManager;
    }

    public ConfigManager getConfigManager() {
        return configManager;
    }

    public MessagesService getMessagesService() {
        return messagesService;
    }

    public HookManager getHookManager() {
        return hookManager;
    }

    public DatabaseModule getDatabaseModule() {
        return databaseModule;
    }

    public CommandModule getCommandModule() {
        return commandModule;
    }

    public GuiModule getGuiModule() {
        return guiModule;
    }

    public boolean isDebug() {
        return debug;
    }

    public void setDebug(boolean debug) {
        this.debug = debug;
    }

    public void debugLog(String message) {
        if (debug) {
            getLogger().info("[DEBUG] " + message);
        }
    }
}

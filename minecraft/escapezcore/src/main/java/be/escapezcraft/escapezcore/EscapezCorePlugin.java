package be.escapezcraft.escapezcore;

import be.escapezcraft.escapezcore.command.CommandModule;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.database.DatabaseModule;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.items.ItemsModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.ModuleManager;
import be.escapezcraft.escapezcore.report.ReportModule;
import be.escapezcraft.escapezcore.resourcepack.ResourcePackModule;
import be.escapezcraft.escapezcore.scoreboard.ScoreboardModule;
import be.escapezcraft.escapezcore.staffchat.StaffChatModule;
import be.escapezcraft.escapezcore.tips.TipsModule;
import be.escapezcraft.escapezcore.vote.VoteReminderModule;
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
    private ReportModule reportModule;
    private StaffChatModule staffChatModule;
    private ScoreboardModule scoreboardModule;
    private TipsModule tipsModule;
    private VoteReminderModule voteReminderModule;
    private ResourcePackModule resourcePackModule;
    private ItemsModule itemsModule;
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
        this.reportModule = new ReportModule(
                this, configManager, messagesService, databaseModule, commandModule.getCooldownService());
        this.staffChatModule = new StaffChatModule(this, configManager, messagesService, databaseModule);
        this.scoreboardModule = new ScoreboardModule(
                this, configManager, messagesService, hookManager, databaseModule);
        this.tipsModule = new TipsModule(this, configManager, messagesService);
        this.voteReminderModule = new VoteReminderModule(this, configManager, messagesService);
        this.resourcePackModule = new ResourcePackModule(this, configManager, messagesService);
        this.itemsModule = new ItemsModule(this, configManager, messagesService, hookManager, guiModule);

        // Give CommandModule access to feature modules after construction
        this.commandModule.wireFeatureModules(reportModule, staffChatModule, scoreboardModule, itemsModule);

        moduleManager.register(configManager);
        moduleManager.register(messagesService);
        moduleManager.register(hookManager);
        moduleManager.register(databaseModule);
        moduleManager.register(guiModule);
        // Reports / staffchat before commands so repositories & listeners are ready at bind time
        moduleManager.register(reportModule);
        moduleManager.register(staffChatModule);
        moduleManager.register(scoreboardModule);
        moduleManager.register(tipsModule);
        moduleManager.register(voteReminderModule);
        moduleManager.register(resourcePackModule);
        // Items after GuiModule so IconResolver can be shared
        moduleManager.register(itemsModule);
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
     * Safe soft-reload: messages, commands, aliases, gui, scoreboard/tips/vote,
     * resourcepack, items, config — never Bukkit.reload().
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

    public ReportModule getReportModule() {
        return reportModule;
    }

    public StaffChatModule getStaffChatModule() {
        return staffChatModule;
    }

    public ScoreboardModule getScoreboardModule() {
        return scoreboardModule;
    }

    public TipsModule getTipsModule() {
        return tipsModule;
    }

    public VoteReminderModule getVoteReminderModule() {
        return voteReminderModule;
    }

    public ResourcePackModule getResourcePackModule() {
        return resourcePackModule;
    }

    public ItemsModule getItemsModule() {
        return itemsModule;
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

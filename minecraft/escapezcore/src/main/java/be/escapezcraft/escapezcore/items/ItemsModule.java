package be.escapezcraft.escapezcore.items;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.gui.icon.IconResolver;
import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import org.bukkit.Bukkit;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.event.HandlerList;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

/**
 * Custom items from items.yml — PDC identity, IconResolver adapters, admin GUI/commands.
 */
public final class ItemsModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final HookManager hooks;
    private final GuiModule guiModule;

    private IconResolver iconResolver;
    private ItemService itemService;
    private ItemAdminCommands adminCommands;
    private ItemsAdminGui adminGui;
    private ItemsGuiListener guiListener;
    private boolean enabled = true;

    public ItemsModule(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            HookManager hooks,
            GuiModule guiModule
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.hooks = hooks;
        this.guiModule = guiModule;
    }

    @Override
    public String getName() {
        return "ItemsModule";
    }

    @Override
    public void enable() {
        // Prefer shared IconResolver from GuiModule when available
        this.iconResolver = guiModule != null && guiModule.getIconResolver() != null
                ? guiModule.getIconResolver()
                : new IconResolver(plugin, hooks);
        this.itemService = new ItemService(plugin, messages, iconResolver);
        this.adminGui = new ItemsAdminGui(plugin, messages, itemService, guiModule);
        this.adminCommands = new ItemAdminCommands(plugin, messages, itemService, adminGui);
        loadDefinitions();
        this.guiListener = new ItemsGuiListener(plugin, adminGui, itemService, messages);
        Bukkit.getPluginManager().registerEvents(guiListener, plugin);
        plugin.getLogger().info("Items-module actief (enabled=" + enabled
                + ", definitions=" + itemService.size() + ").");
    }

    @Override
    public void disable() {
        if (guiListener != null) {
            HandlerList.unregisterAll(guiListener);
            guiListener = null;
        }
        if (itemService != null) {
            itemService.replaceDefinitions(Map.of());
        }
    }

    @Override
    public void reload() {
        loadDefinitions();
        plugin.getLogger().info("items.yml herladen (" + itemService.size() + " items, enabled=" + enabled + ").");
    }

    private void loadDefinitions() {
        FileConfiguration cfg = configManager.getItems();
        Map<String, ItemDefinition> next = new LinkedHashMap<>();
        if (cfg == null) {
            enabled = false;
            itemService.replaceDefinitions(next);
            return;
        }
        enabled = cfg.getBoolean("enabled", true);
        ConfigurationSection section = cfg.getConfigurationSection("items");
        if (section != null && enabled) {
            for (String key : section.getKeys(false)) {
                ConfigurationSection itemSec = section.getConfigurationSection(key);
                if (itemSec == null) {
                    continue;
                }
                String id = key.trim().toLowerCase(Locale.ROOT);
                if (id.isBlank()) {
                    continue;
                }
                next.put(id, ItemDefinition.from(id, itemSec));
            }
        }
        itemService.replaceDefinitions(next);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public ItemService getItemService() {
        return itemService;
    }

    public ItemAdminCommands getAdminCommands() {
        return adminCommands;
    }

    public ItemsAdminGui getAdminGui() {
        return adminGui;
    }
}

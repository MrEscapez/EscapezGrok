package be.escapezcraft.escapezcore.gui;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.gui.editor.GuiEditorSkeleton;
import be.escapezcraft.escapezcore.gui.icon.IconResolver;
import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Configurable gui.yml inventories with icon adapters, PDC identity, and anti-exploit clicks.
 */
public final class GuiModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final HookManager hooks;

    private IconResolver iconResolver;
    private GuiItemFactory itemFactory;
    private GuiActionExecutor actionExecutor;
    private GuiEditorSkeleton editor;
    private GuiListener listener;

    private final Map<String, GuiMenuDefinition> menus = new LinkedHashMap<>();
    private final Map<UUID, String> openMenus = new LinkedHashMap<>();

    public GuiModule(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            HookManager hooks
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.hooks = hooks;
    }

    @Override
    public String getName() {
        return "GuiModule";
    }

    @Override
    public void enable() {
        this.iconResolver = new IconResolver(plugin, hooks);
        this.itemFactory = new GuiItemFactory(plugin, messages, iconResolver);
        this.actionExecutor = new GuiActionExecutor(plugin, this, messages);
        this.editor = new GuiEditorSkeleton(plugin, this, messages);
        loadMenus();
        this.listener = new GuiListener(plugin, this, actionExecutor);
        Bukkit.getPluginManager().registerEvents(listener, plugin);
        plugin.getLogger().info("GUI-module actief (" + menus.size() + " menu's uit gui.yml).");
    }

    @Override
    public void disable() {
        openMenus.clear();
        menus.clear();
    }

    @Override
    public void reload() {
        reloadMenusOnly();
        plugin.getLogger().info("GUI-definitie herladen uit gui.yml (" + menus.size() + " menu's).");
    }

    /**
     * Reload gui.yml menus only (also used by editor reload stub / soft-reload).
     */
    public void reloadMenusOnly() {
        // ConfigManager already reloads files before modules if softReload order is Config first;
        // re-read from current ConfigManager state.
        if (iconResolver != null) {
            iconResolver.clearLoggedFailures();
        }
        loadMenus();
    }

    private void loadMenus() {
        menus.clear();
        FileConfiguration gui = configManager.getGui();
        if (gui == null) {
            return;
        }
        for (String key : gui.getKeys(false)) {
            ConfigurationSection section = gui.getConfigurationSection(key);
            if (section == null) {
                continue;
            }
            // Skip non-menu top-level keys (e.g. future settings)
            if (!section.contains("size") && !section.contains("items") && !section.contains("title")) {
                continue;
            }
            GuiMenuDefinition def = GuiMenuDefinition.from(key.toLowerCase(Locale.ROOT), section);
            menus.put(def.menuId(), def);
        }
    }

    public void openMain(Player player) {
        openMenu(player, "main");
    }

    public void openAdmin(Player player) {
        GuiMenuDefinition admin = menus.get("admin");
        if (admin != null && admin.permission() != null && !player.hasPermission(admin.permission())) {
            messages.send(player, "no-permission");
            return;
        }
        if (admin == null) {
            String perm = configManager.getGui().getString("admin.permission", "escapezcore.admin.gui");
            if (!player.hasPermission(perm)) {
                messages.send(player, "no-permission");
                return;
            }
        }
        openMenu(player, "admin");
    }

    /**
     * Open any registered menu by id (permission on menu + hide-if-no-permission items).
     */
    public void openMenu(Player player, String menuId) {
        if (menuId == null || menuId.isBlank()) {
            return;
        }
        String id = menuId.toLowerCase(Locale.ROOT);
        GuiMenuDefinition menu = menus.get(id);
        if (menu == null) {
            plugin.getLogger().warning("GUI menu ontbreekt: " + id);
            return;
        }
        if (menu.permission() != null && !player.hasPermission(menu.permission())) {
            messages.send(player, "no-permission");
            return;
        }

        Component title = messages.parse(menu.title());
        EscapezGuiHolder holder = new EscapezGuiHolder(id);
        Inventory inventory = Bukkit.createInventory(holder, menu.size(), title);
        holder.setInventory(inventory);

        for (GuiItemDefinition item : menu.items()) {
            if (item.hideIfNoPermission()
                    && item.permission() != null
                    && !player.hasPermission(item.permission())) {
                continue;
            }
            ItemStack stack = itemFactory.build(item);
            inventory.setItem(item.slot(), stack);
        }

        openMenus.put(player.getUniqueId(), id);
        player.openInventory(inventory);
        plugin.debugLog("Opened GUI '" + id + "' for " + player.getUniqueId());
    }

    public boolean hasMenu(String menuId) {
        return menuId != null && menus.containsKey(menuId.toLowerCase(Locale.ROOT));
    }

    public GuiMenuDefinition getMenu(String menuId) {
        if (menuId == null) {
            return null;
        }
        return menus.get(menuId.toLowerCase(Locale.ROOT));
    }

    public Set<String> listMenuIds() {
        return Collections.unmodifiableSet(menus.keySet());
    }

    public String getOpenMenu(UUID uuid) {
        return openMenus.get(uuid);
    }

    public void clearOpenMenu(UUID uuid) {
        openMenus.remove(uuid);
    }

    public GuiEditorSkeleton getEditor() {
        return editor;
    }

    public IconResolver getIconResolver() {
        return iconResolver;
    }

    public GuiItemFactory getItemFactory() {
        return itemFactory;
    }

    public EscapezCorePlugin getPlugin() {
        return plugin;
    }
}

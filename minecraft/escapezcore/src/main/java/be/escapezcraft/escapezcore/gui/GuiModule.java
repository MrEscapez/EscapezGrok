package be.escapezcraft.escapezcore.gui;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Basic gui.yml inventories with MATERIAL icons and click actions.
 */
public final class GuiModule implements Module {

    public static final String MAIN_TITLE_MARKER = "EscapezCraft";
    public static final String ADMIN_TITLE_MARKER = "EscapezCore Admin";

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final Map<UUID, String> openMenus = new HashMap<>();
    private GuiListener listener;

    public GuiModule(EscapezCorePlugin plugin, ConfigManager configManager, MessagesService messages) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
    }

    @Override
    public String getName() {
        return "GuiModule";
    }

    @Override
    public void enable() {
        this.listener = new GuiListener(plugin, this, configManager, messages);
        Bukkit.getPluginManager().registerEvents(listener, plugin);
    }

    @Override
    public void disable() {
        openMenus.clear();
    }

    @Override
    public void reload() {
        plugin.getLogger().info("GUI-definitie herladen uit gui.yml.");
    }

    public void openMain(Player player) {
        openFromSection(player, "main");
    }

    public void openAdmin(Player player) {
        ConfigurationSection admin = configManager.getGui().getConfigurationSection("admin");
        if (admin != null) {
            String perm = admin.getString("permission", "escapezcore.admin.gui");
            if (!player.hasPermission(perm)) {
                messages.send(player, "no-permission");
                return;
            }
        }
        openFromSection(player, "admin");
    }

    private void openFromSection(Player player, String sectionName) {
        ConfigurationSection section = configManager.getGui().getConfigurationSection(sectionName);
        if (section == null) {
            plugin.getLogger().warning("GUI section missing: " + sectionName);
            return;
        }

        String titleRaw = section.getString("title", "<white>Menu</white>");
        int size = section.getInt("size", 27);
        if (size % 9 != 0 || size < 9 || size > 54) {
            size = 27;
        }

        Component title = messages.parse(titleRaw);
        EscapezGuiHolder holder = new EscapezGuiHolder(sectionName);
        Inventory inventory = Bukkit.createInventory(holder, size, title);
        holder.setInventory(inventory);

        ConfigurationSection items = section.getConfigurationSection("items");
        if (items != null) {
            for (String key : items.getKeys(false)) {
                ConfigurationSection itemSec = items.getConfigurationSection(key);
                if (itemSec == null) {
                    continue;
                }
                int slot = itemSec.getInt("slot", -1);
                if (slot < 0 || slot >= size) {
                    continue;
                }
                ItemStack stack = buildItem(itemSec);
                inventory.setItem(slot, stack);
            }
        }

        openMenus.put(player.getUniqueId(), sectionName);
        player.openInventory(inventory);
        plugin.debugLog("Opened GUI '" + sectionName + "' for " + player.getUniqueId());
    }

    private ItemStack buildItem(ConfigurationSection itemSec) {
        String materialName = itemSec.getString("material", "STONE");
        Material material = Material.matchMaterial(materialName);
        if (material == null || !material.isItem()) {
            material = Material.STONE;
        }
        ItemStack stack = new ItemStack(material);
        ItemMeta meta = stack.getItemMeta();
        if (meta != null) {
            String name = itemSec.getString("name");
            if (name != null) {
                meta.displayName(messages.parse(name));
            }
            List<String> loreRaw = itemSec.getStringList("lore");
            if (!loreRaw.isEmpty()) {
                List<Component> lore = new ArrayList<>();
                for (String line : loreRaw) {
                    lore.add(messages.parse(line));
                }
                meta.lore(lore);
            }
            stack.setItemMeta(meta);
        }
        return stack;
    }

    public String getOpenMenu(UUID uuid) {
        return openMenus.get(uuid);
    }

    public void clearOpenMenu(UUID uuid) {
        openMenus.remove(uuid);
    }

    public EscapezCorePlugin getPlugin() {
        return plugin;
    }
}

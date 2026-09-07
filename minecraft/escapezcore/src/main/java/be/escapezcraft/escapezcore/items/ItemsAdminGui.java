package be.escapezcraft.escapezcore.items;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.gui.EscapezGuiHolder;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.gui.item.GuiItemKeys;
import be.escapezcraft.escapezcore.messages.MessagesService;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Dynamic admin items browser — reuses EscapezGuiHolder + IconResolver/ItemService patterns.
 * Menu id {@link #MENU_ID} is not in gui.yml; {@link ItemsGuiListener} handles clicks.
 */
public final class ItemsAdminGui {

    public static final String MENU_ID = "admin-items";

    private final EscapezCorePlugin plugin;
    private final MessagesService messages;
    private final ItemService items;
    private final GuiModule guiModule;

    public ItemsAdminGui(
            EscapezCorePlugin plugin,
            MessagesService messages,
            ItemService items,
            GuiModule guiModule
    ) {
        this.plugin = plugin;
        this.messages = messages;
        this.items = items;
        this.guiModule = guiModule;
    }

    public void open(Player player) {
        if (!player.hasPermission(ItemAdminCommands.PERM_GUI)
                && !player.hasPermission("escapezcore.admin")) {
            messages.send(player, "no-permission");
            return;
        }

        List<ItemDefinition> defs = new ArrayList<>(items.list());
        int rows = Math.max(3, Math.min(6, ((defs.size() + 9) / 9) + 1));
        int size = rows * 9;

        Component title = messages.parse("<red><bold>Custom Items</bold></red>");
        EscapezGuiHolder holder = new EscapezGuiHolder(MENU_ID);
        Inventory inventory = Bukkit.createInventory(holder, size, title);
        holder.setInventory(inventory);

        int slot = 0;
        for (ItemDefinition def : defs) {
            if (slot >= size - 9) {
                break;
            }
            ItemStack preview = items.create(def, 1);
            ItemMeta meta = preview.getItemMeta();
            if (meta != null) {
                List<Component> lore = meta.lore() == null ? new ArrayList<>() : new ArrayList<>(meta.lore());
                lore.add(Component.empty());
                lore.add(messages.parse("<dark_gray>Klik om 1× te geven</dark_gray>"));
                meta.lore(lore);
                preview.setItemMeta(meta);
            }
            inventory.setItem(slot++, preview);
        }

        ItemStack close = new ItemStack(Material.BARRIER);
        ItemMeta closeMeta = close.getItemMeta();
        if (closeMeta != null) {
            closeMeta.displayName(messages.parse("<red>Sluiten</red>"));
            closeMeta.addItemFlags(ItemFlag.HIDE_ATTRIBUTES);
            GuiItemKeys.setItemId(plugin, closeMeta, "__close__");
            close.setItemMeta(closeMeta);
        }
        inventory.setItem(size - 5, close);

        player.openInventory(inventory);
        messages.send(player, "items-gui-opened", Map.of("count", String.valueOf(defs.size())));
        plugin.debugLog("Opened items admin GUI for " + player.getUniqueId());
    }

    public boolean isItemsMenu(String menuId) {
        return MENU_ID.equals(menuId);
    }

    public ItemService getItemService() {
        return items;
    }

    public GuiModule getGuiModule() {
        return guiModule;
    }
}

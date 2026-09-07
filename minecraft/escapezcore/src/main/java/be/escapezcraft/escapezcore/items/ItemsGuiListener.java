package be.escapezcraft.escapezcore.items;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.gui.EscapezGuiHolder;
import be.escapezcraft.escapezcore.gui.item.GuiItemKeys;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryAction;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;

import java.util.Map;

/**
 * Click handler for the dynamic admin-items GUI (EscapezGuiHolder menuId admin-items).
 * GuiListener cancels unknown Escapez menus; this listener performs give on left/right click.
 */
public final class ItemsGuiListener implements Listener {

    private final EscapezCorePlugin plugin;
    private final ItemsAdminGui adminGui;
    private final ItemService items;
    private final MessagesService messages;

    public ItemsGuiListener(
            EscapezCorePlugin plugin,
            ItemsAdminGui adminGui,
            ItemService items,
            MessagesService messages
    ) {
        this.plugin = plugin;
        this.adminGui = adminGui;
        this.items = items;
        this.messages = messages;
    }

    @EventHandler(priority = EventPriority.NORMAL, ignoreCancelled = false)
    public void onClick(InventoryClickEvent event) {
        if (!(event.getView().getTopInventory().getHolder() instanceof EscapezGuiHolder holder)) {
            return;
        }
        if (!adminGui.isItemsMenu(holder.getMenuId())) {
            return;
        }

        event.setCancelled(true);

        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        if (!player.hasPermission(ItemAdminCommands.PERM_GUI)
                && !player.hasPermission("escapezcore.admin")) {
            messages.send(player, "no-permission");
            player.closeInventory();
            return;
        }

        Inventory clicked = event.getClickedInventory();
        if (clicked == null || clicked != event.getView().getTopInventory()) {
            return;
        }
        if (event.getClick() != ClickType.LEFT && event.getClick() != ClickType.RIGHT) {
            return;
        }
        InventoryAction action = event.getAction();
        if (action != InventoryAction.PICKUP_ALL
                && action != InventoryAction.PICKUP_HALF
                && action != InventoryAction.PICKUP_ONE
                && action != InventoryAction.PICKUP_SOME
                && action != InventoryAction.NOTHING) {
            return;
        }

        ItemStack stack = event.getCurrentItem();
        if (stack == null || stack.getType().isAir()) {
            return;
        }
        String id = GuiItemKeys.getItemId(plugin, stack);
        if (id == null) {
            return;
        }
        if ("__close__".equals(id)) {
            player.closeInventory();
            return;
        }
        if (!player.hasPermission(ItemAdminCommands.PERM_GIVE)
                && !player.hasPermission("escapezcore.admin")) {
            messages.send(player, "no-permission");
            return;
        }
        if (items.get(id) == null) {
            messages.send(player, "items-unknown", Map.of("id", id));
            return;
        }
        if (items.give(player, id, 1)) {
            messages.send(player, "items-given", Map.of(
                    "id", id,
                    "amount", "1",
                    "player", player.getName()
            ));
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = false)
    public void onDrag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder() instanceof EscapezGuiHolder holder
                && adminGui.isItemsMenu(holder.getMenuId())) {
            event.setCancelled(true);
        }
    }
}

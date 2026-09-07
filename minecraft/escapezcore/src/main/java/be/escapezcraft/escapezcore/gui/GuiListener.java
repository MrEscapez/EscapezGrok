package be.escapezcraft.escapezcore.gui;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.ClickType;
import org.bukkit.event.inventory.InventoryAction;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryCreativeEvent;
import org.bukkit.event.inventory.InventoryDragEvent;
import org.bukkit.inventory.Inventory;

/**
 * Anti-exploit click protection for EscapezCore GUIs + action dispatch.
 *
 * Cancels all unwanted interactions (shift-click, number-key, drag, collect,
 * cursor placement, double-click, creative clone, etc.). Only defined click
 * handlers on the top inventory run; clicks outside the top inventory are ignored
 * after cancel. Holder + menuId are validated.
 */
public final class GuiListener implements Listener {

    private final EscapezCorePlugin plugin;
    private final GuiModule guiModule;
    private final GuiActionExecutor actions;

    public GuiListener(EscapezCorePlugin plugin, GuiModule guiModule, GuiActionExecutor actions) {
        this.plugin = plugin;
        this.guiModule = guiModule;
        this.actions = actions;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = false)
    public void onClick(InventoryClickEvent event) {
        if (!(event.getView().getTopInventory().getHolder() instanceof EscapezGuiHolder holder)) {
            return;
        }

        // Always cancel first — no item movement into/out of Escapez GUIs
        event.setCancelled(true);

        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }

        String menuId = holder.getMenuId();
        if (menuId == null || menuId.isBlank() || !guiModule.hasMenu(menuId)) {
            plugin.debugLog("GUI click geweigerd: ongeldige menuId '" + menuId + "'");
            return;
        }

        // Tracked open menu must match holder (stale / spoofed view)
        String tracked = guiModule.getOpenMenu(player.getUniqueId());
        if (tracked != null && !tracked.equals(menuId)) {
            plugin.debugLog("GUI click geweigerd: tracked=" + tracked + " holder=" + menuId
                    + " uuid=" + player.getUniqueId());
            return;
        }

        // Ignore clicks outside top inventory (player inv / outside)
        Inventory clicked = event.getClickedInventory();
        if (clicked == null || clicked != event.getView().getTopInventory()) {
            return;
        }

        // Only allow simple defined handlers — block exploit click types
        if (!isAllowedClick(event)) {
            plugin.debugLog("GUI exploit-click geblokkeerd: " + event.getClick()
                    + " / " + event.getAction() + " uuid=" + player.getUniqueId());
            return;
        }

        int slot = event.getSlot();
        if (slot < 0 || slot >= event.getView().getTopInventory().getSize()) {
            return;
        }

        GuiMenuDefinition menu = guiModule.getMenu(menuId);
        if (menu == null) {
            return;
        }
        GuiItemDefinition item = menu.itemAt(slot);
        if (item == null) {
            return;
        }

        actions.execute(player, item);
    }

    /**
     * Allowed interaction for dispatching configured actions.
     * Everything else is cancelled above and ignored here.
     */
    private boolean isAllowedClick(InventoryClickEvent event) {
        ClickType click = event.getClick();
        InventoryAction action = event.getAction();

        if (click != ClickType.LEFT && click != ClickType.RIGHT) {
            return false;
        }

        return switch (action) {
            case PICKUP_ALL, PICKUP_HALF, PICKUP_ONE, PICKUP_SOME -> true;
            // Some clients report NOTHING on empty decorative slots — still allow handler lookup
            case NOTHING -> true;
            default -> false;
        };
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = false)
    public void onDrag(InventoryDragEvent event) {
        if (event.getView().getTopInventory().getHolder() instanceof EscapezGuiHolder) {
            event.setCancelled(true);
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = false)
    public void onCreative(InventoryCreativeEvent event) {
        if (event.getView().getTopInventory().getHolder() instanceof EscapezGuiHolder) {
            event.setCancelled(true);
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent event) {
        if (event.getInventory().getHolder() instanceof EscapezGuiHolder
                && event.getPlayer() instanceof Player player) {
            guiModule.clearOpenMenu(player.getUniqueId());
        }
    }
}

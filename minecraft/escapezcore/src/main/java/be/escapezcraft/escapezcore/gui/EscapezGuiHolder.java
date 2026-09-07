package be.escapezcraft.escapezcore.gui;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.Nullable;

/**
 * Marks EscapezCore GUI inventories for click protection.
 */
public final class EscapezGuiHolder implements InventoryHolder {

    private final String menuId;
    private Inventory inventory;

    public EscapezGuiHolder(String menuId) {
        this.menuId = menuId;
    }

    public String getMenuId() {
        return menuId;
    }

    public void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    @Override
    public @Nullable Inventory getInventory() {
        return inventory;
    }
}

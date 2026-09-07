package be.escapezcraft.escapezcore.gui;

import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.InventoryHolder;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

/**
 * Marks EscapezCore GUI inventories for click protection and menu validation.
 */
public final class EscapezGuiHolder implements InventoryHolder {

    private final String menuId;
    private final boolean editorMode;
    private Inventory inventory;

    public EscapezGuiHolder(String menuId) {
        this(menuId, false);
    }

    public EscapezGuiHolder(String menuId, boolean editorMode) {
        this.menuId = menuId;
        this.editorMode = editorMode;
    }

    public String getMenuId() {
        return menuId;
    }

    public boolean isEditorMode() {
        return editorMode;
    }

    public void setInventory(Inventory inventory) {
        this.inventory = inventory;
    }

    @Override
    public @NotNull Inventory getInventory() {
        return inventory;
    }
}

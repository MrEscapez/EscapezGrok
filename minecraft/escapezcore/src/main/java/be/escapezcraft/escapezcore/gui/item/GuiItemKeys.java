package be.escapezcraft.escapezcore.gui.item;

import org.bukkit.NamespacedKey;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.bukkit.persistence.PersistentDataType;
import org.bukkit.plugin.Plugin;
import org.jetbrains.annotations.Nullable;

/**
 * Custom item identity via PDC — never display name.
 * Namespace: escapezcraft, key: item_id.
 */
public final class GuiItemKeys {

    public static final String NAMESPACE = "escapezcraft";
    public static final String ITEM_ID_KEY = "item_id";

    private GuiItemKeys() {
    }

    public static NamespacedKey itemIdKey(Plugin plugin) {
        // Prefer fixed namespace escapezcraft over plugin name so identity is stable across renames
        return new NamespacedKey(NAMESPACE, ITEM_ID_KEY);
    }

    public static void setItemId(Plugin plugin, ItemMeta meta, String itemId) {
        if (meta == null || itemId == null || itemId.isBlank()) {
            return;
        }
        meta.getPersistentDataContainer().set(itemIdKey(plugin), PersistentDataType.STRING, itemId);
    }

    public static @Nullable String getItemId(Plugin plugin, ItemStack stack) {
        if (stack == null || !stack.hasItemMeta()) {
            return null;
        }
        ItemMeta meta = stack.getItemMeta();
        if (meta == null) {
            return null;
        }
        return meta.getPersistentDataContainer().get(itemIdKey(plugin), PersistentDataType.STRING);
    }

    public static boolean hasItemId(Plugin plugin, ItemStack stack, String expected) {
        String id = getItemId(plugin, stack);
        return id != null && id.equals(expected);
    }
}

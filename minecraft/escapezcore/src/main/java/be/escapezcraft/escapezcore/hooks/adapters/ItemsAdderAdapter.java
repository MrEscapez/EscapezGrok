package be.escapezcraft.escapezcore.hooks.adapters;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.AdapterMode;
import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;

import java.lang.reflect.Method;
import java.util.Optional;

/**
 * ItemsAdder soft-dep via documented public API reflection
 * ({@code dev.lone.itemsadder.api.CustomStack}) — no invented signatures.
 */
public final class ItemsAdderAdapter extends AbstractPluginAdapter {

    private volatile Method getInstance;
    private volatile Method getItemStack;

    public ItemsAdderAdapter(EscapezCorePlugin plugin) {
        super(plugin, "itemsadder", "ItemsAdder", AdapterMode.REFLECTION);
    }

    @Override
    protected boolean onHook() throws Exception {
        Class<?> customStack = Class.forName("dev.lone.itemsadder.api.CustomStack");
        getInstance = customStack.getMethod("getInstance", String.class);
        getItemStack = customStack.getMethod("getItemStack");
        return getInstance != null && getItemStack != null;
    }

    @Override
    protected void onUnhook() {
        getInstance = null;
        getItemStack = null;
    }

    public Optional<ItemStack> item(String namespacedId) {
        if (!isAvailable() || namespacedId == null || namespacedId.isBlank()) {
            return Optional.empty();
        }
        try {
            Object instance = getInstance.invoke(null, namespacedId);
            if (instance == null) {
                return Optional.empty();
            }
            Object stack = getItemStack.invoke(instance);
            if (stack instanceof ItemStack itemStack
                    && itemStack.getType() != Material.AIR) {
                return Optional.of(itemStack.clone());
            }
        } catch (Throwable t) {
            plugin.debugLog("ItemsAdder item '" + namespacedId + "': " + t.getMessage());
        }
        return Optional.empty();
    }
}

package be.escapezcraft.escapezcore.hooks.adapters;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.AdapterMode;
import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;

import java.lang.reflect.Method;
import java.util.Optional;

/**
 * Nexo soft-dep via documented public API reflection
 * ({@code com.nexomc.nexo.api.NexoItems#itemFromId}) — no invented signatures.
 */
public final class NexoAdapter extends AbstractPluginAdapter {

    private volatile Method itemFromId;

    public NexoAdapter(EscapezCorePlugin plugin) {
        super(plugin, "nexo", "Nexo", AdapterMode.REFLECTION);
    }

    @Override
    protected boolean onHook() throws Exception {
        Class<?> nexoItems = Class.forName("com.nexomc.nexo.api.NexoItems");
        itemFromId = nexoItems.getMethod("itemFromId", String.class);
        return itemFromId != null;
    }

    @Override
    protected void onUnhook() {
        itemFromId = null;
    }

    public Optional<ItemStack> item(String id) {
        if (!isAvailable() || id == null || id.isBlank() || itemFromId == null) {
            return Optional.empty();
        }
        try {
            Object builder = itemFromId.invoke(null, id);
            if (builder == null) {
                return Optional.empty();
            }
            Method build = builder.getClass().getMethod("build");
            Object stack = build.invoke(builder);
            if (stack instanceof ItemStack itemStack
                    && itemStack.getType() != Material.AIR) {
                return Optional.of(itemStack.clone());
            }
        } catch (Throwable t) {
            plugin.debugLog("Nexo item '" + id + "': " + t.getMessage());
        }
        return Optional.empty();
    }
}

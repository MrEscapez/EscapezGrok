package be.escapezcraft.escapezcore.gui.icon;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.HookManager;
import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;

import java.lang.reflect.Method;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves MATERIAL | NEXO | ITEMSADDER icons with safe fallback.
 * Soft-deps via HookManager + reflection only — never crashes if missing/invalid.
 * Failed custom ids are logged once per id.
 */
public final class IconResolver {

    private final EscapezCorePlugin plugin;
    private final HookManager hooks;
    private final Set<String> loggedFailures = ConcurrentHashMap.newKeySet();

    public IconResolver(EscapezCorePlugin plugin, HookManager hooks) {
        this.plugin = plugin;
        this.hooks = hooks;
    }

    public void clearLoggedFailures() {
        loggedFailures.clear();
    }

    public ItemStack resolve(IconSpec spec) {
        if (spec == null) {
            return new ItemStack(Material.STONE);
        }
        return switch (spec.type()) {
            case MATERIAL -> materialStack(spec.id(), spec.fallbackMaterial());
            case NEXO -> resolveNexo(spec);
            case ITEMSADDER -> resolveItemsAdder(spec);
        };
    }

    private ItemStack resolveNexo(IconSpec spec) {
        if (!hooks.isPresent("Nexo")) {
            logOnce("nexo-missing", "Nexo niet aanwezig — fallback MATERIAL voor id '" + spec.id() + "'");
            return materialStack(spec.fallbackMaterial(), "STONE");
        }
        try {
            ItemStack custom = invokeNexo(spec.id());
            if (custom != null && custom.getType() != Material.AIR) {
                return custom;
            }
            logOnce("nexo:" + spec.id(), "Nexo id ongeldig of leeg: '" + spec.id() + "' — fallback MATERIAL");
        } catch (Throwable t) {
            logOnce("nexo-err:" + spec.id(),
                    "Nexo resolve mislukt voor '" + spec.id() + "': " + t.getMessage());
            plugin.debugLog("Nexo reflection: " + t);
        }
        return materialStack(spec.fallbackMaterial(), "STONE");
    }

    private ItemStack resolveItemsAdder(IconSpec spec) {
        if (!hooks.isPresent("ItemsAdder")) {
            logOnce("ia-missing", "ItemsAdder niet aanwezig — fallback MATERIAL voor id '" + spec.id() + "'");
            return materialStack(spec.fallbackMaterial(), "STONE");
        }
        try {
            ItemStack custom = invokeItemsAdder(spec.id());
            if (custom != null && custom.getType() != Material.AIR) {
                return custom;
            }
            logOnce("ia:" + spec.id(), "ItemsAdder id ongeldig of leeg: '" + spec.id() + "' — fallback MATERIAL");
        } catch (Throwable t) {
            logOnce("ia-err:" + spec.id(),
                    "ItemsAdder resolve mislukt voor '" + spec.id() + "': " + t.getMessage());
            plugin.debugLog("ItemsAdder reflection: " + t);
        }
        return materialStack(spec.fallbackMaterial(), "STONE");
    }

    /**
     * Soft reflection against Nexo public API (com.nexomc.nexo.api.NexoItems#itemFromId).
     */
    private ItemStack invokeNexo(String id) throws Exception {
        Class<?> nexoItems = Class.forName("com.nexomc.nexo.api.NexoItems");
        Method itemFromId = nexoItems.getMethod("itemFromId", String.class);
        Object builder = itemFromId.invoke(null, id);
        if (builder == null) {
            return null;
        }
        Method build = builder.getClass().getMethod("build");
        Object stack = build.invoke(builder);
        return stack instanceof ItemStack itemStack ? itemStack.clone() : null;
    }

    /**
     * Soft reflection against ItemsAdder public API (dev.lone.itemsadder.api.CustomStack).
     */
    private ItemStack invokeItemsAdder(String id) throws Exception {
        Class<?> customStack = Class.forName("dev.lone.itemsadder.api.CustomStack");
        Method getInstance = customStack.getMethod("getInstance", String.class);
        Object instance = getInstance.invoke(null, id);
        if (instance == null) {
            return null;
        }
        Method getItemStack = customStack.getMethod("getItemStack");
        Object stack = getItemStack.invoke(instance);
        return stack instanceof ItemStack itemStack ? itemStack.clone() : null;
    }

    private ItemStack materialStack(String materialName, String ultimateFallback) {
        Material material = matchItemMaterial(materialName);
        if (material == null) {
            material = matchItemMaterial(ultimateFallback);
        }
        if (material == null) {
            material = Material.STONE;
        }
        return new ItemStack(material);
    }

    private static Material matchItemMaterial(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        Material material = Material.matchMaterial(name.trim());
        if (material == null || !material.isItem()) {
            return null;
        }
        return material;
    }

    private void logOnce(String key, String message) {
        if (loggedFailures.add(key)) {
            plugin.getLogger().warning("[GUI icons] " + message);
        }
    }
}

package be.escapezcraft.escapezcore.gui.icon;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.hooks.HookManager;
import be.escapezcraft.escapezcore.hooks.adapters.ItemsAdderAdapter;
import be.escapezcraft.escapezcore.hooks.adapters.NexoAdapter;
import org.bukkit.Material;
import org.bukkit.inventory.ItemStack;

import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Resolves MATERIAL | NEXO | ITEMSADDER icons with safe fallback.
 * Soft-deps via HookManager adapters — never crashes if missing/invalid.
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
        Optional<NexoAdapter> adapter = hooks.getAdapter(NexoAdapter.class);
        if (adapter.isEmpty() || !adapter.get().isAvailable()) {
            logOnce("nexo-missing", "Nexo niet aanwezig — fallback MATERIAL voor id '" + spec.id() + "'");
            return materialStack(spec.fallbackMaterial(), "STONE");
        }
        try {
            Optional<ItemStack> custom = adapter.get().item(spec.id());
            if (custom.isPresent()) {
                return custom.get();
            }
            logOnce("nexo:" + spec.id(), "Nexo id ongeldig of leeg: '" + spec.id() + "' — fallback MATERIAL");
        } catch (Throwable t) {
            logOnce("nexo-err:" + spec.id(),
                    "Nexo resolve mislukt voor '" + spec.id() + "': " + t.getMessage());
            plugin.debugLog("Nexo adapter: " + t);
        }
        return materialStack(spec.fallbackMaterial(), "STONE");
    }

    private ItemStack resolveItemsAdder(IconSpec spec) {
        Optional<ItemsAdderAdapter> adapter = hooks.getAdapter(ItemsAdderAdapter.class);
        if (adapter.isEmpty() || !adapter.get().isAvailable()) {
            logOnce("ia-missing", "ItemsAdder niet aanwezig — fallback MATERIAL voor id '" + spec.id() + "'");
            return materialStack(spec.fallbackMaterial(), "STONE");
        }
        try {
            Optional<ItemStack> custom = adapter.get().item(spec.id());
            if (custom.isPresent()) {
                return custom.get();
            }
            logOnce("ia:" + spec.id(), "ItemsAdder id ongeldig of leeg: '" + spec.id() + "' — fallback MATERIAL");
        } catch (Throwable t) {
            logOnce("ia-err:" + spec.id(),
                    "ItemsAdder resolve mislukt voor '" + spec.id() + "': " + t.getMessage());
            plugin.debugLog("ItemsAdder adapter: " + t);
        }
        return materialStack(spec.fallbackMaterial(), "STONE");
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

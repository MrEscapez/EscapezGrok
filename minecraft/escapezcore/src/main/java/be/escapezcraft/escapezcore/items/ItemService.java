package be.escapezcraft.escapezcore.items;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.gui.icon.IconResolver;
import be.escapezcraft.escapezcore.gui.item.GuiItemKeys;
import be.escapezcraft.escapezcore.messages.MessagesService;
import net.kyori.adventure.text.Component;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Builds and identifies custom items via PDC {@code escapezcraft:item_id}.
 */
public final class ItemService {

    private final EscapezCorePlugin plugin;
    private final MessagesService messages;
    private final IconResolver iconResolver;
    private final Map<String, ItemDefinition> definitions = new LinkedHashMap<>();

    public ItemService(EscapezCorePlugin plugin, MessagesService messages, IconResolver iconResolver) {
        this.plugin = plugin;
        this.messages = messages;
        this.iconResolver = iconResolver;
    }

    public void replaceDefinitions(Map<String, ItemDefinition> next) {
        definitions.clear();
        if (next != null) {
            definitions.putAll(next);
        }
        if (iconResolver != null) {
            iconResolver.clearLoggedFailures();
        }
    }

    public @Nullable ItemDefinition get(String id) {
        if (id == null) {
            return null;
        }
        return definitions.get(id.trim().toLowerCase(Locale.ROOT));
    }

    public Collection<ItemDefinition> list() {
        return Collections.unmodifiableCollection(definitions.values());
    }

    public Collection<String> ids() {
        return Collections.unmodifiableCollection(definitions.keySet());
    }

    public boolean isEmpty() {
        return definitions.isEmpty();
    }

    public int size() {
        return definitions.size();
    }

    /**
     * Build a stack with display/lore/glow/CMD and PDC item_id = definition id.
     */
    public ItemStack create(ItemDefinition def, int amount) {
        ItemStack stack = iconResolver.resolve(def.icon());
        int amt = amount > 0 ? Math.min(64, amount) : def.amount();
        stack.setAmount(Math.max(1, amt));

        ItemMeta meta = stack.getItemMeta();
        if (meta == null) {
            return stack;
        }

        if (def.displayName() != null && !def.displayName().isBlank()) {
            meta.displayName(messages.parse(def.displayName()));
        }

        List<String> loreRaw = def.lore();
        if (!loreRaw.isEmpty()) {
            List<Component> lore = new ArrayList<>(loreRaw.size());
            for (String line : loreRaw) {
                lore.add(messages.parse(line));
            }
            meta.lore(lore);
        }

        if (def.customModelData() > 0) {
            meta.setCustomModelData(def.customModelData());
        }
        if (def.glow()) {
            meta.setEnchantmentGlintOverride(true);
        }
        meta.addItemFlags(
                ItemFlag.HIDE_ATTRIBUTES,
                ItemFlag.HIDE_ENCHANTS,
                ItemFlag.HIDE_ADDITIONAL_TOOLTIP
        );

        // Identity via PDC — never display name
        GuiItemKeys.setItemId(plugin, meta, def.id());
        stack.setItemMeta(meta);
        return stack;
    }

    public ItemStack create(String id, int amount) {
        ItemDefinition def = get(id);
        if (def == null) {
            return null;
        }
        return create(def, amount);
    }

    /**
     * Give item to player inventory; leftovers dropped at feet.
     * @return false if id unknown
     */
    public boolean give(Player player, String id, int amount) {
        ItemStack stack = create(id, amount);
        if (stack == null) {
            return false;
        }
        Map<Integer, ItemStack> leftover = player.getInventory().addItem(stack);
        if (!leftover.isEmpty()) {
            for (ItemStack left : leftover.values()) {
                player.getWorld().dropItemNaturally(player.getLocation(), left);
            }
        }
        return true;
    }

    public @Nullable String resolveId(ItemStack stack) {
        return GuiItemKeys.getItemId(plugin, stack);
    }
}

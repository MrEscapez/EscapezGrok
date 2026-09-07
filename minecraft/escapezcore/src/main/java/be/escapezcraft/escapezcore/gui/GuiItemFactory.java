package be.escapezcraft.escapezcore.gui;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.gui.icon.IconResolver;
import be.escapezcraft.escapezcore.gui.item.GuiItemKeys;
import be.escapezcraft.escapezcore.messages.MessagesService;
import net.kyori.adventure.text.Component;
import org.bukkit.inventory.ItemFlag;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.meta.ItemMeta;

import java.util.ArrayList;
import java.util.List;

/**
 * Builds ItemStacks for GUI slots: icon resolve, MiniMessage name/lore,
 * amount, glow, custom model data, PDC item_id identity.
 */
public final class GuiItemFactory {

    private final EscapezCorePlugin plugin;
    private final MessagesService messages;
    private final IconResolver iconResolver;

    public GuiItemFactory(EscapezCorePlugin plugin, MessagesService messages, IconResolver iconResolver) {
        this.plugin = plugin;
        this.messages = messages;
        this.iconResolver = iconResolver;
    }

    public ItemStack build(GuiItemDefinition def) {
        ItemStack stack = iconResolver.resolve(def.icon());
        stack.setAmount(def.amount());

        ItemMeta meta = stack.getItemMeta();
        if (meta == null) {
            return stack;
        }

        if (def.name() != null) {
            meta.displayName(messages.parse(def.name()));
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

        // Identity via PDC — not display name
        GuiItemKeys.setItemId(plugin, meta, def.itemKey());

        stack.setItemMeta(meta);
        return stack;
    }
}

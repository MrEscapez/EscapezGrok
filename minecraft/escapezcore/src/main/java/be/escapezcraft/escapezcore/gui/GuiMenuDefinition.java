package be.escapezcraft.escapezcore.gui;

import org.bukkit.configuration.ConfigurationSection;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * One menu from gui.yml (e.g. main, admin).
 */
public final class GuiMenuDefinition {

    private final String menuId;
    private final String title;
    private final int size;
    private final @Nullable String permission;
    private final Map<Integer, GuiItemDefinition> itemsBySlot;
    private final List<GuiItemDefinition> items;

    private GuiMenuDefinition(
            String menuId,
            String title,
            int size,
            @Nullable String permission,
            Map<Integer, GuiItemDefinition> itemsBySlot,
            List<GuiItemDefinition> items
    ) {
        this.menuId = menuId;
        this.title = title;
        this.size = size;
        this.permission = permission;
        this.itemsBySlot = itemsBySlot;
        this.items = items;
    }

    public static GuiMenuDefinition from(String menuId, ConfigurationSection section) {
        String title = section.getString("title", "<white>Menu</white>");
        int size = section.getInt("size", 27);
        if (size % 9 != 0 || size < 9 || size > 54) {
            size = 27;
        }
        String perm = section.getString("permission");
        if (perm != null && perm.isBlank()) {
            perm = null;
        }

        Map<Integer, GuiItemDefinition> bySlot = new LinkedHashMap<>();
        List<GuiItemDefinition> list = new ArrayList<>();
        ConfigurationSection itemsSec = section.getConfigurationSection("items");
        if (itemsSec != null) {
            for (String key : itemsSec.getKeys(false)) {
                ConfigurationSection itemSec = itemsSec.getConfigurationSection(key);
                if (itemSec == null) {
                    continue;
                }
                GuiItemDefinition def = GuiItemDefinition.from(key, itemSec);
                if (def.slot() < 0 || def.slot() >= size) {
                    continue;
                }
                bySlot.put(def.slot(), def);
                list.add(def);
            }
        }
        return new GuiMenuDefinition(menuId, title, size, perm,
                Collections.unmodifiableMap(bySlot),
                Collections.unmodifiableList(list));
    }

    public String menuId() {
        return menuId;
    }

    public String title() {
        return title;
    }

    public int size() {
        return size;
    }

    public @Nullable String permission() {
        return permission;
    }

    public @Nullable GuiItemDefinition itemAt(int slot) {
        return itemsBySlot.get(slot);
    }

    public Map<Integer, GuiItemDefinition> itemsBySlot() {
        return itemsBySlot;
    }

    public List<GuiItemDefinition> items() {
        return items;
    }
}

package be.escapezcraft.escapezcore.items;

import be.escapezcraft.escapezcore.gui.icon.IconSpec;
import org.bukkit.configuration.ConfigurationSection;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * One custom item from items.yml. Identity is the config key (stored in PDC item_id).
 */
public final class ItemDefinition {

    private final String id;
    private final @Nullable String displayName;
    private final List<String> lore;
    private final IconSpec icon;
    private final int amount;
    private final boolean glow;
    private final int customModelData;

    public ItemDefinition(
            String id,
            @Nullable String displayName,
            List<String> lore,
            IconSpec icon,
            int amount,
            boolean glow,
            int customModelData
    ) {
        this.id = id;
        this.displayName = displayName;
        this.lore = lore == null ? List.of() : List.copyOf(lore);
        this.icon = icon;
        this.amount = amount;
        this.glow = glow;
        this.customModelData = customModelData;
    }

    public static ItemDefinition from(String id, ConfigurationSection section) {
        String key = id == null ? "" : id.trim().toLowerCase(Locale.ROOT);
        IconSpec icon = IconSpec.fromItemSection(section);
        int amount = Math.max(1, Math.min(64, section.getInt("amount", 1)));
        int cmd = section.getInt("custom-model-data", section.getInt("custom_model_data", 0));
        String name = section.getString("display-name", section.getString("name"));
        return new ItemDefinition(
                key,
                name,
                section.getStringList("lore"),
                icon,
                amount,
                section.getBoolean("glow", false),
                cmd
        );
    }

    public String id() {
        return id;
    }

    public @Nullable String displayName() {
        return displayName;
    }

    public List<String> lore() {
        return lore == null ? Collections.emptyList() : lore;
    }

    public IconSpec icon() {
        return icon;
    }

    public int amount() {
        return amount;
    }

    public boolean glow() {
        return glow;
    }

    public int customModelData() {
        return customModelData;
    }
}

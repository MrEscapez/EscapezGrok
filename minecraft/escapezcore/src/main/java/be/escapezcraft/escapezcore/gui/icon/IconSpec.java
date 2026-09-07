package be.escapezcraft.escapezcore.gui.icon;

import org.bukkit.configuration.ConfigurationSection;
import org.jetbrains.annotations.Nullable;

/**
 * Icon resolution request from gui.yml (icon block or legacy material field).
 */
public record IconSpec(
        IconType type,
        String id,
        @Nullable String fallbackMaterial
) {

    public static IconSpec fromItemSection(ConfigurationSection itemSec) {
        if (itemSec == null) {
            return new IconSpec(IconType.MATERIAL, "STONE", "STONE");
        }

        ConfigurationSection icon = itemSec.getConfigurationSection("icon");
        if (icon != null) {
            IconType type = IconType.fromString(icon.getString("type", "MATERIAL"));
            String id = icon.getString("id", icon.getString("material", "STONE"));
            String fallback = icon.getString("fallback",
                    itemSec.getString("material", "STONE"));
            return new IconSpec(type, id == null ? "STONE" : id, fallback);
        }

        // Legacy: material: STONE
        String material = itemSec.getString("material", "STONE");
        return new IconSpec(IconType.MATERIAL, material, material);
    }
}

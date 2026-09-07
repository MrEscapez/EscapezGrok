package be.escapezcraft.escapezcore.gui.icon;

import java.util.Locale;

/**
 * Supported GUI icon sources. Soft-deps resolve via reflection; MATERIAL is always available.
 */
public enum IconType {
    MATERIAL,
    NEXO,
    ITEMSADDER;

    public static IconType fromString(String raw) {
        if (raw == null || raw.isBlank()) {
            return MATERIAL;
        }
        return switch (raw.trim().toUpperCase(Locale.ROOT)) {
            case "NEXO" -> NEXO;
            case "ITEMSADDER", "IA", "ITEMS_ADDER" -> ITEMSADDER;
            default -> MATERIAL;
        };
    }
}

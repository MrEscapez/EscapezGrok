package be.escapezcraft.escapezcore.gui;

import be.escapezcraft.escapezcore.gui.icon.IconSpec;
import org.bukkit.configuration.ConfigurationSection;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.List;
import java.util.Locale;

/**
 * One configurable GUI button from gui.yml.
 */
public final class GuiItemDefinition {

    private final String itemKey;
    private final int slot;
    private final IconSpec icon;
    private final int amount;
    private final boolean glow;
    private final int customModelData;
    private final @Nullable String permission;
    private final boolean hideIfNoPermission;
    private final @Nullable String name;
    private final List<String> lore;
    private final String action;
    private final @Nullable String command;
    private final @Nullable String openMenu;
    private final @Nullable String message;
    private final @Nullable String messageKey;
    private final @Nullable String adminAction;

    private GuiItemDefinition(
            String itemKey,
            int slot,
            IconSpec icon,
            int amount,
            boolean glow,
            int customModelData,
            @Nullable String permission,
            boolean hideIfNoPermission,
            @Nullable String name,
            List<String> lore,
            String action,
            @Nullable String command,
            @Nullable String openMenu,
            @Nullable String message,
            @Nullable String messageKey,
            @Nullable String adminAction
    ) {
        this.itemKey = itemKey;
        this.slot = slot;
        this.icon = icon;
        this.amount = amount;
        this.glow = glow;
        this.customModelData = customModelData;
        this.permission = permission;
        this.hideIfNoPermission = hideIfNoPermission;
        this.name = name;
        this.lore = lore;
        this.action = action;
        this.command = command;
        this.openMenu = openMenu;
        this.message = message;
        this.messageKey = messageKey;
        this.adminAction = adminAction;
    }

    public static GuiItemDefinition from(String itemKey, ConfigurationSection section) {
        IconSpec icon = IconSpec.fromItemSection(section);
        int amount = Math.max(1, Math.min(64, section.getInt("amount", 1)));
        int cmd = section.getInt("custom-model-data", section.getInt("custom_model_data", 0));
        String perm = section.getString("permission");
        if (perm != null && perm.isBlank()) {
            perm = null;
        }
        String action = section.getString("action", "none");
        if (action == null || action.isBlank()) {
            action = "none";
        }
        String open = section.getString("open", section.getString("menu"));
        return new GuiItemDefinition(
                itemKey,
                section.getInt("slot", -1),
                icon,
                amount,
                section.getBoolean("glow", false),
                cmd,
                perm,
                section.getBoolean("hide-if-no-permission", false),
                section.getString("name"),
                List.copyOf(section.getStringList("lore")),
                action.toLowerCase(Locale.ROOT),
                section.getString("command"),
                open,
                section.getString("message"),
                section.getString("message-key"),
                section.getString("admin-action")
        );
    }

    public String itemKey() {
        return itemKey;
    }

    public int slot() {
        return slot;
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

    public @Nullable String permission() {
        return permission;
    }

    public boolean hideIfNoPermission() {
        return hideIfNoPermission;
    }

    public @Nullable String name() {
        return name;
    }

    public List<String> lore() {
        return lore == null ? Collections.emptyList() : lore;
    }

    public String action() {
        return action;
    }

    public @Nullable String command() {
        return command;
    }

    public @Nullable String openMenu() {
        return openMenu;
    }

    public @Nullable String message() {
        return message;
    }

    public @Nullable String messageKey() {
        return messageKey;
    }

    public @Nullable String adminAction() {
        return adminAction;
    }
}

package be.escapezcraft.escapezcore.command;

import org.bukkit.configuration.ConfigurationSection;

import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * Strongly typed view of a single commands.yml entry.
 */
public final class CommandDefinition {

    private final String key;
    private final boolean enabled;
    private final List<String> aliases;
    private final String permission;
    private final int cooldownSeconds;
    private final String cooldownBypass;
    private final boolean consoleAllowed;
    private final boolean playerOnly;
    private final boolean hidden;
    private final boolean logging;
    private final String messageKey;
    private final String url;
    private final String description;
    private final String clickAction;

    private CommandDefinition(
            String key,
            boolean enabled,
            List<String> aliases,
            String permission,
            int cooldownSeconds,
            String cooldownBypass,
            boolean consoleAllowed,
            boolean playerOnly,
            boolean hidden,
            boolean logging,
            String messageKey,
            String url,
            String description,
            String clickAction
    ) {
        this.key = key;
        this.enabled = enabled;
        this.aliases = aliases;
        this.permission = permission;
        this.cooldownSeconds = cooldownSeconds;
        this.cooldownBypass = cooldownBypass;
        this.consoleAllowed = consoleAllowed;
        this.playerOnly = playerOnly;
        this.hidden = hidden;
        this.logging = logging;
        this.messageKey = messageKey;
        this.url = url;
        this.description = description;
        this.clickAction = clickAction;
    }

    public static CommandDefinition from(String key, ConfigurationSection section, int defaultCooldown) {
        Objects.requireNonNull(key, "key");
        Objects.requireNonNull(section, "section");
        List<String> aliases = section.getStringList("aliases");
        return new CommandDefinition(
                key.toLowerCase(Locale.ROOT),
                section.getBoolean("enabled", true),
                aliases == null ? List.of() : List.copyOf(aliases),
                section.getString("permission", "escapezcore.command." + key),
                section.getInt("cooldown-seconds", defaultCooldown),
                section.getString("cooldown-bypass", CooldownService.BYPASS_PERMISSION),
                section.getBoolean("console-allowed", true),
                section.getBoolean("player-only", false),
                section.getBoolean("hidden", false),
                section.getBoolean("logging", true),
                section.getString("message-key", "info-" + key),
                section.getString("url", "https://example.com"),
                section.getString("description", key),
                section.getString("click-action", "open_url")
        );
    }

    public String key() {
        return key;
    }

    public boolean enabled() {
        return enabled;
    }

    public List<String> aliases() {
        return aliases;
    }

    public String permission() {
        return permission;
    }

    public int cooldownSeconds() {
        return cooldownSeconds;
    }

    public String cooldownBypass() {
        return cooldownBypass;
    }

    public boolean consoleAllowed() {
        return consoleAllowed;
    }

    public boolean playerOnly() {
        return playerOnly;
    }

    public boolean hidden() {
        return hidden;
    }

    public boolean logging() {
        return logging;
    }

    public String messageKey() {
        return messageKey;
    }

    public String url() {
        return url;
    }

    public String description() {
        return description;
    }

    public String clickAction() {
        return clickAction == null ? "open_url" : clickAction;
    }

    public List<String> allLabels() {
        if (aliases.isEmpty()) {
            return List.of(key);
        }
        java.util.ArrayList<String> labels = new java.util.ArrayList<>(1 + aliases.size());
        labels.add(key);
        labels.addAll(aliases);
        return Collections.unmodifiableList(labels);
    }
}

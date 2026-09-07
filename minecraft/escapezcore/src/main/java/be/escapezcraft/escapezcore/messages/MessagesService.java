package be.escapezcraft.escapezcore.messages;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.module.Module;
import net.kyori.adventure.text.Component;
import net.kyori.adventure.text.minimessage.MiniMessage;
import net.kyori.adventure.text.minimessage.tag.resolver.Placeholder;
import net.kyori.adventure.text.minimessage.tag.resolver.TagResolver;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;

import java.util.Map;

/**
 * MiniMessage-based Dutch message service.
 * Supports both brace placeholders {@code {key}} (preferred in messages.yml,
 * including inside MiniMessage tag arguments such as click URLs) and
 * MiniMessage tags {@code <key>}.
 */
public final class MessagesService implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MiniMessage miniMessage = MiniMessage.miniMessage();
    private String prefixRaw = "";

    public MessagesService(EscapezCorePlugin plugin, ConfigManager configManager) {
        this.plugin = plugin;
        this.configManager = configManager;
    }

    @Override
    public String getName() {
        return "MessagesService";
    }

    @Override
    public void enable() {
        refreshPrefix();
    }

    @Override
    public void disable() {
        // no-op
    }

    @Override
    public void reload() {
        refreshPrefix();
    }

    private void refreshPrefix() {
        FileConfiguration messages = configManager.getMessages();
        this.prefixRaw = messages.getString("prefix",
                configManager.getConfig().getString("prefix", ""));
    }

    public Component parse(String miniMessageInput) {
        return parse(miniMessageInput, null);
    }

    /**
     * Deserialize MiniMessage after applying brace placeholders, then MiniMessage tags.
     * Brace substitution runs first so values work inside tag arguments
     * (e.g. {@code <click:open_url:'{url}'>}).
     */
    public Component parse(String miniMessageInput, Map<String, String> placeholders) {
        if (miniMessageInput == null || miniMessageInput.isEmpty()) {
            return Component.empty();
        }
        String raw = applyBracePlaceholders(miniMessageInput, placeholders);
        if (placeholders == null || placeholders.isEmpty()) {
            return miniMessage.deserialize(raw);
        }
        TagResolver.Builder builder = TagResolver.builder();
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            String value = entry.getValue() == null ? "" : entry.getValue();
            builder.resolver(Placeholder.unparsed(entry.getKey(), value));
        }
        return miniMessage.deserialize(raw, builder.build());
    }

    /**
     * Replace {@code {key}} tokens in a raw string. Used by message formatting
     * and safe for MiniMessage tag arguments (unlike tag resolvers alone).
     */
    public static String applyBracePlaceholders(String input, Map<String, String> placeholders) {
        if (input == null || placeholders == null || placeholders.isEmpty()) {
            return input == null ? "" : input;
        }
        String raw = input;
        for (Map.Entry<String, String> entry : placeholders.entrySet()) {
            String value = entry.getValue() == null ? "" : entry.getValue();
            raw = raw.replace("{" + entry.getKey() + "}", value);
        }
        return raw;
    }

    public Component get(String key) {
        String raw = configManager.getMessages().getString(key, "<red>Missing message: " + key + "</red>");
        return parse(raw);
    }

    public Component get(String key, Map<String, String> placeholders) {
        String raw = configManager.getMessages().getString(key, "<red>Missing message: " + key + "</red>");
        return parse(raw, placeholders);
    }

    public Component prefixed(String key) {
        return parse(prefixRaw).append(get(key));
    }

    public Component prefixed(String key, Map<String, String> placeholders) {
        return parse(prefixRaw).append(get(key, placeholders));
    }

    public void send(CommandSender sender, String key) {
        sender.sendMessage(prefixed(key));
    }

    public void send(CommandSender sender, String key, Map<String, String> placeholders) {
        sender.sendMessage(prefixed(key, placeholders));
    }

    public void sendRaw(CommandSender sender, String key) {
        sender.sendMessage(get(key));
    }

    public void sendRaw(CommandSender sender, String key, Map<String, String> placeholders) {
        sender.sendMessage(get(key, placeholders));
    }

    public String getPrefixRaw() {
        return prefixRaw;
    }

    public MiniMessage miniMessage() {
        return miniMessage;
    }
}

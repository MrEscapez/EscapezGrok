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
        if (miniMessageInput == null || miniMessageInput.isEmpty()) {
            return Component.empty();
        }
        return miniMessage.deserialize(miniMessageInput);
    }

    public Component get(String key) {
        String raw = configManager.getMessages().getString(key, "<red>Missing message: " + key + "</red>");
        return parse(raw);
    }

    public Component get(String key, Map<String, String> placeholders) {
        String raw = configManager.getMessages().getString(key, "<red>Missing message: " + key + "</red>");
        TagResolver.Builder builder = TagResolver.builder();
        if (placeholders != null) {
            for (Map.Entry<String, String> entry : placeholders.entrySet()) {
                builder.resolver(Placeholder.parsed(entry.getKey(), entry.getValue() == null ? "" : entry.getValue()));
            }
        }
        return miniMessage.deserialize(raw, builder.build());
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

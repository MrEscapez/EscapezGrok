package be.escapezcraft.escapezcore.gui;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.util.Locale;
import java.util.Map;

/**
 * Dispatches configured click actions for GUI items.
 */
public final class GuiActionExecutor {

    private final EscapezCorePlugin plugin;
    private final GuiModule guiModule;
    private final MessagesService messages;

    public GuiActionExecutor(EscapezCorePlugin plugin, GuiModule guiModule, MessagesService messages) {
        this.plugin = plugin;
        this.guiModule = guiModule;
        this.messages = messages;
    }

    public void execute(Player player, GuiItemDefinition item) {
        if (item.permission() != null && !player.hasPermission(item.permission())) {
            messages.send(player, "no-permission");
            return;
        }

        String action = item.action() == null ? "none" : item.action().toLowerCase(Locale.ROOT);
        switch (action) {
            case "close" -> player.closeInventory();
            case "command" -> {
                String cmd = item.command();
                player.closeInventory();
                if (cmd != null && !cmd.isBlank()) {
                    // Next tick so inventory close finishes cleanly
                    Bukkit.getScheduler().runTask(plugin, () -> player.performCommand(cmd.trim()));
                }
            }
            case "console" -> {
                String cmd = item.command();
                player.closeInventory();
                if (cmd != null && !cmd.isBlank()) {
                    String parsed = cmd.replace("%player%", player.getName())
                            .replace("%uuid%", player.getUniqueId().toString());
                    Bukkit.getScheduler().runTask(plugin, () ->
                            Bukkit.dispatchCommand(Bukkit.getConsoleSender(), parsed));
                }
            }
            case "open", "menu" -> {
                String menuId = item.openMenu();
                if (menuId == null || menuId.isBlank()) {
                    return;
                }
                Bukkit.getScheduler().runTask(plugin, () -> guiModule.openMenu(player, menuId.trim()));
            }
            case "message" -> {
                if (item.messageKey() != null && !item.messageKey().isBlank()) {
                    messages.send(player, item.messageKey());
                } else if (item.message() != null && !item.message().isBlank()) {
                    player.sendMessage(messages.parse(item.message()));
                }
            }
            case "admin" -> handleAdmin(player, item);
            case "none", "" -> {
                // intentional no-op
            }
            default -> plugin.debugLog("Onbekende GUI action '" + action + "' op item " + item.itemKey());
        }
    }

    private void handleAdmin(Player player, GuiItemDefinition item) {
        String adminAction = item.adminAction() == null ? "" : item.adminAction().toLowerCase(Locale.ROOT);
        player.closeInventory();
        switch (adminAction) {
            case "reload" -> {
                if (!player.hasPermission("escapezcore.admin.reload")) {
                    messages.send(player, "no-permission");
                    return;
                }
                Bukkit.getScheduler().runTask(plugin, () -> {
                    try {
                        plugin.softReload();
                        messages.send(player, "reload-success");
                    } catch (Exception ex) {
                        messages.send(player, "reload-failed",
                                Map.of("error", ex.getMessage() == null ? "unknown" : ex.getMessage()));
                    }
                });
            }
            case "debug" -> {
                if (!player.hasPermission("escapezcore.admin")) {
                    messages.send(player, "no-permission");
                    return;
                }
                boolean next = !plugin.isDebug();
                plugin.setDebug(next);
                messages.send(player, "debug-enabled", Map.of("state", next ? "aan" : "uit"));
            }
            case "editor", "gui-editor" -> {
                if (!player.hasPermission("escapezcore.admin.gui")) {
                    messages.send(player, "no-permission");
                    return;
                }
                Bukkit.getScheduler().runTask(plugin, () ->
                        guiModule.getEditor().openEditorHome(player));
            }
            case "items", "item", "items-gui" -> {
                if (!player.hasPermission("escapezcore.admin.item.gui")
                        && !player.hasPermission("escapezcore.admin")) {
                    messages.send(player, "no-permission");
                    return;
                }
                Bukkit.getScheduler().runTask(plugin, () -> {
                    var items = plugin.getItemsModule();
                    if (items == null || items.getAdminGui() == null) {
                        messages.send(player, "items-disabled");
                        return;
                    }
                    items.getAdminGui().open(player);
                });
            }
            default -> plugin.debugLog("Onbekende admin-action: " + adminAction);
        }
    }
}

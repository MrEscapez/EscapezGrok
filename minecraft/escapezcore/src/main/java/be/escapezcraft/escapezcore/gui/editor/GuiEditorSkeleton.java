package be.escapezcraft.escapezcore.gui.editor;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.gui.GuiMenuDefinition;
import be.escapezcraft.escapezcore.gui.GuiModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import net.kyori.adventure.text.Component;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * In-game GUI editor skeleton (admin-gated).
 * Not a full visual editor — list / open-for-inspect / stub save / reload hooks
 * that can grow later.
 *
 * Entry: {@code /ec admin gui [list|open <id>|reload|save|edit]}
 */
public final class GuiEditorSkeleton {

    public static final String PERMISSION = "escapezcore.admin.gui";

    private final EscapezCorePlugin plugin;
    private final GuiModule guiModule;
    private final MessagesService messages;

    public GuiEditorSkeleton(EscapezCorePlugin plugin, GuiModule guiModule, MessagesService messages) {
        this.plugin = plugin;
        this.guiModule = guiModule;
        this.messages = messages;
    }

    /**
     * Handle {@code /ec admin gui ...} after permission already verified by EscapezCommand.
     */
    public boolean handle(CommandSender sender, String[] args) {
        if (!sender.hasPermission(PERMISSION)) {
            messages.send(sender, "no-permission");
            return true;
        }

        if (args.length == 0) {
            if (sender instanceof Player player) {
                guiModule.openAdmin(player);
            } else {
                sendUsage(sender);
            }
            return true;
        }

        String sub = args[0].toLowerCase(Locale.ROOT);
        switch (sub) {
            case "list" -> listMenus(sender);
            case "open" -> {
                if (!(sender instanceof Player player)) {
                    messages.send(sender, "player-only");
                    return true;
                }
                if (args.length < 2) {
                    messages.send(sender, "gui-editor-usage");
                    return true;
                }
                String menuId = args[1].toLowerCase(Locale.ROOT);
                if (!guiModule.hasMenu(menuId)) {
                    messages.send(sender, "gui-editor-unknown-menu", Map.of("menu", menuId));
                    return true;
                }
                guiModule.openMenu(player, menuId);
                messages.send(sender, "gui-editor-opened", Map.of("menu", menuId));
            }
            case "reload" -> {
                try {
                    guiModule.reloadMenusOnly();
                    messages.send(sender, "gui-editor-reloaded");
                } catch (Exception ex) {
                    messages.send(sender, "reload-failed",
                            Map.of("error", ex.getMessage() == null ? "unknown" : ex.getMessage()));
                }
            }
            case "save" -> {
                // Stub — full visual editor will persist changes here later
                messages.send(sender, "gui-editor-save-stub");
                plugin.getLogger().info("[GUI editor] save stub aangeroepen door "
                        + (sender instanceof Player p ? p.getUniqueId() : "console"));
            }
            case "edit" -> {
                if (!(sender instanceof Player player)) {
                    messages.send(sender, "player-only");
                    return true;
                }
                openEditorHome(player);
            }
            case "help" -> sendUsage(sender);
            default -> {
                // Bare menu id shortcut: /ec admin gui main
                String menuId = sub;
                if (guiModule.hasMenu(menuId)) {
                    if (!(sender instanceof Player player)) {
                        messages.send(sender, "player-only");
                        return true;
                    }
                    guiModule.openMenu(player, menuId);
                    messages.send(sender, "gui-editor-opened", Map.of("menu", menuId));
                } else {
                    sendUsage(sender);
                }
            }
        }
        return true;
    }

    public void openEditorHome(Player player) {
        messages.send(player, "gui-editor-home");
        listMenus(player);
        player.sendMessage(messages.parse(
                "<gray>Inspecteer met </gray><yellow>/ec admin gui open <id></yellow>"
                        + "<gray> · stub save: </gray><yellow>/ec admin gui save</yellow>"));
    }

    public void listMenus(CommandSender sender) {
        List<String> ids = new ArrayList<>(guiModule.listMenuIds());
        if (ids.isEmpty()) {
            messages.send(sender, "gui-editor-empty");
            return;
        }
        messages.send(sender, "gui-editor-list-header");
        for (String id : ids) {
            GuiMenuDefinition def = guiModule.getMenu(id);
            int slots = def == null ? 0 : def.items().size();
            int size = def == null ? 0 : def.size();
            Component line = messages.parse(
                    "<gray>• </gray><aqua>" + id + "</aqua>"
                            + "<dark_gray> — </dark_gray><white>" + size + " slots</white>"
                            + "<dark_gray>, </dark_gray><white>" + slots + " items</white>");
            sender.sendMessage(line);
        }
    }

    public List<String> tabComplete(CommandSender sender, String[] args) {
        if (!sender.hasPermission(PERMISSION)) {
            return List.of();
        }
        if (args.length == 1) {
            String p = args[0].toLowerCase(Locale.ROOT);
            List<String> opts = new ArrayList<>(List.of("list", "open", "reload", "save", "edit", "help"));
            opts.addAll(guiModule.listMenuIds());
            return opts.stream().filter(s -> s.startsWith(p)).sorted().toList();
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("open")) {
            String p = args[1].toLowerCase(Locale.ROOT);
            return guiModule.listMenuIds().stream()
                    .filter(s -> s.startsWith(p))
                    .sorted()
                    .toList();
        }
        return List.of();
    }

    private void sendUsage(CommandSender sender) {
        messages.send(sender, "gui-editor-usage");
    }
}

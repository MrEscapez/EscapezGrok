package be.escapezcraft.escapezcore.gui;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.entity.Player;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.inventory.InventoryClickEvent;
import org.bukkit.event.inventory.InventoryCloseEvent;
import org.bukkit.event.inventory.InventoryDragEvent;

import java.util.Map;

/**
 * Click protection for EscapezCore GUIs + action dispatch.
 */
public final class GuiListener implements Listener {

    private final EscapezCorePlugin plugin;
    private final GuiModule guiModule;
    private final ConfigManager configManager;
    private final MessagesService messages;

    public GuiListener(
            EscapezCorePlugin plugin,
            GuiModule guiModule,
            ConfigManager configManager,
            MessagesService messages
    ) {
        this.plugin = plugin;
        this.guiModule = guiModule;
        this.configManager = configManager;
        this.messages = messages;
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onClick(InventoryClickEvent event) {
        if (!(event.getInventory().getHolder() instanceof EscapezGuiHolder holder)) {
            return;
        }
        event.setCancelled(true);

        if (!(event.getWhoClicked() instanceof Player player)) {
            return;
        }
        if (event.getClickedInventory() == null) {
            return;
        }
        if (event.getClickedInventory() != event.getView().getTopInventory()) {
            return;
        }

        int slot = event.getSlot();
        String menuId = holder.getMenuId();
        ConfigurationSection items = configManager.getGui().getConfigurationSection(menuId + ".items");
        if (items == null) {
            return;
        }

        for (String key : items.getKeys(false)) {
            ConfigurationSection item = items.getConfigurationSection(key);
            if (item == null || item.getInt("slot", -1) != slot) {
                continue;
            }
            handleAction(player, item);
            return;
        }
    }

    @EventHandler(priority = EventPriority.HIGH, ignoreCancelled = true)
    public void onDrag(InventoryDragEvent event) {
        if (event.getInventory().getHolder() instanceof EscapezGuiHolder) {
            event.setCancelled(true);
        }
    }

    @EventHandler
    public void onClose(InventoryCloseEvent event) {
        if (event.getInventory().getHolder() instanceof EscapezGuiHolder
                && event.getPlayer() instanceof Player player) {
            guiModule.clearOpenMenu(player.getUniqueId());
        }
    }

    private void handleAction(Player player, ConfigurationSection item) {
        String action = item.getString("action", "none");
        switch (action.toLowerCase()) {
            case "close" -> player.closeInventory();
            case "command" -> {
                String cmd = item.getString("command", "");
                player.closeInventory();
                if (!cmd.isEmpty()) {
                    player.performCommand(cmd);
                }
            }
            case "admin" -> {
                String adminAction = item.getString("admin-action", "");
                player.closeInventory();
                switch (adminAction.toLowerCase()) {
                    case "reload" -> {
                        if (!player.hasPermission("escapezcore.admin.reload")) {
                            messages.send(player, "no-permission");
                            return;
                        }
                        try {
                            plugin.softReload();
                            messages.send(player, "reload-success");
                        } catch (Exception ex) {
                            messages.send(player, "reload-failed",
                                    Map.of("error", ex.getMessage() == null ? "unknown" : ex.getMessage()));
                        }
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
                    default -> {
                    }
                }
            }
            default -> {
            }
        }
    }
}

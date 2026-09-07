package be.escapezcraft.escapezcore.items;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.gui.item.GuiItemKeys;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.Bukkit;
import org.bukkit.Material;
import org.bukkit.command.CommandSender;
import org.bukkit.entity.Player;
import org.bukkit.inventory.ItemStack;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Stealth admin: {@code /ec admin item <give|get|info|list|gui>}.
 */
public final class ItemAdminCommands {

    public static final String PERM_ITEM = "escapezcore.admin.item";
    public static final String PERM_GIVE = "escapezcore.admin.item.give";
    public static final String PERM_GUI = "escapezcore.admin.item.gui";

    private final EscapezCorePlugin plugin;
    private final MessagesService messages;
    private final ItemService items;
    private final ItemsAdminGui adminGui;

    public ItemAdminCommands(
            EscapezCorePlugin plugin,
            MessagesService messages,
            ItemService items,
            ItemsAdminGui adminGui
    ) {
        this.plugin = plugin;
        this.messages = messages;
        this.items = items;
        this.adminGui = adminGui;
    }

    public boolean handle(CommandSender sender, String[] args) {
        if (!sender.hasPermission(PERM_ITEM) && !sender.hasPermission("escapezcore.admin")) {
            messages.send(sender, "no-permission");
            return true;
        }

        if (args.length == 0) {
            sender.sendMessage(messages.parse(
                    "<gray>/ec admin item <list|info|give|get|gui></gray>"));
            return true;
        }

        String sub = args[0].toLowerCase(Locale.ROOT);
        return switch (sub) {
            case "list" -> handleList(sender);
            case "info" -> handleInfo(sender, Arrays.copyOfRange(args, 1, args.length));
            case "give" -> handleGive(sender, Arrays.copyOfRange(args, 1, args.length), false);
            case "get" -> handleGive(sender, Arrays.copyOfRange(args, 1, args.length), true);
            case "gui" -> handleGui(sender);
            default -> {
                sender.sendMessage(messages.parse(
                        "<gray>/ec admin item <list|info|give|get|gui></gray>"));
                yield true;
            }
        };
    }

    private boolean handleList(CommandSender sender) {
        if (items.isEmpty()) {
            messages.send(sender, "items-list-empty");
            return true;
        }
        messages.send(sender, "items-list-header", Map.of("count", String.valueOf(items.size())));
        for (ItemDefinition def : items.list()) {
            messages.sendRaw(sender, "items-list-line", Map.of(
                    "id", def.id(),
                    "icon", def.icon().type().name() + ":" + def.icon().id()
            ));
        }
        return true;
    }

    private boolean handleInfo(CommandSender sender, String[] args) {
        if (args.length >= 1) {
            String id = args[0].toLowerCase(Locale.ROOT);
            ItemDefinition def = items.get(id);
            if (def == null) {
                messages.send(sender, "items-unknown", Map.of("id", id));
                return true;
            }
            sendDefinitionInfo(sender, def);
            return true;
        }

        if (!(sender instanceof Player player)) {
            messages.send(sender, "player-only");
            return true;
        }
        ItemStack hand = player.getInventory().getItemInMainHand();
        if (hand.getType() == Material.AIR) {
            messages.send(sender, "no-item");
            return true;
        }
        String pdcId = GuiItemKeys.getItemId(plugin, hand);
        if (pdcId == null) {
            messages.send(sender, "item-info", Map.of("material", hand.getType().name()));
            messages.send(sender, "items-info-no-pdc");
            return true;
        }
        ItemDefinition def = items.get(pdcId);
        messages.send(sender, "item-info-id", Map.of(
                "material", hand.getType().name(),
                "item_id", pdcId));
        if (def != null) {
            sendDefinitionInfo(sender, def);
        } else {
            messages.send(sender, "items-info-orphan", Map.of("id", pdcId));
        }
        return true;
    }

    private void sendDefinitionInfo(CommandSender sender, ItemDefinition def) {
        messages.send(sender, "items-info", Map.of(
                "id", def.id(),
                "icon", def.icon().type().name() + ":" + def.icon().id(),
                "fallback", def.icon().fallbackMaterial() == null ? "-" : def.icon().fallbackMaterial(),
                "glow", def.glow() ? "ja" : "nee",
                "cmd", String.valueOf(def.customModelData())
        ));
    }

    private boolean handleGive(CommandSender sender, String[] args, boolean getSelf) {
        if (!sender.hasPermission(PERM_GIVE) && !sender.hasPermission("escapezcore.admin")) {
            messages.send(sender, "no-permission");
            return true;
        }
        if (args.length < 1) {
            messages.send(sender, getSelf ? "items-get-usage" : "items-give-usage");
            return true;
        }

        String id = args[0].toLowerCase(Locale.ROOT);
        if (items.get(id) == null) {
            messages.send(sender, "items-unknown", Map.of("id", id));
            return true;
        }

        Player target;
        int amount;
        if (getSelf) {
            if (!(sender instanceof Player player)) {
                messages.send(sender, "player-only");
                return true;
            }
            target = player;
            amount = args.length >= 2 ? parseAmount(args[1]) : 1;
        } else {
            // give <id> [player] [amount]  OR  give <id> [amount] (self)
            if (args.length == 1) {
                if (!(sender instanceof Player player)) {
                    messages.send(sender, "items-give-usage");
                    return true;
                }
                target = player;
                amount = 1;
            } else if (args.length == 2) {
                Player online = Bukkit.getPlayerExact(args[1]);
                if (online != null) {
                    target = online;
                    amount = 1;
                } else if (isInt(args[1])) {
                    if (!(sender instanceof Player player)) {
                        messages.send(sender, "items-give-usage");
                        return true;
                    }
                    target = player;
                    amount = parseAmount(args[1]);
                } else {
                    messages.send(sender, "items-player-not-found", Map.of("player", args[1]));
                    return true;
                }
            } else {
                Player online = Bukkit.getPlayerExact(args[1]);
                if (online == null) {
                    messages.send(sender, "items-player-not-found", Map.of("player", args[1]));
                    return true;
                }
                target = online;
                amount = parseAmount(args[2]);
            }
        }

        if (!items.give(target, id, amount)) {
            messages.send(sender, "items-unknown", Map.of("id", id));
            return true;
        }
        messages.send(sender, "items-given", Map.of(
                "id", id,
                "amount", String.valueOf(amount),
                "player", target.getName()
        ));
        if (!target.equals(sender)) {
            messages.send(target, "items-received", Map.of(
                    "id", id,
                    "amount", String.valueOf(amount)
            ));
        }
        return true;
    }

    private boolean handleGui(CommandSender sender) {
        if (!sender.hasPermission(PERM_GUI) && !sender.hasPermission("escapezcore.admin")) {
            messages.send(sender, "no-permission");
            return true;
        }
        if (!(sender instanceof Player player)) {
            messages.send(sender, "player-only");
            return true;
        }
        adminGui.open(player);
        return true;
    }

    public List<String> tabComplete(CommandSender sender, String[] args) {
        if (!sender.hasPermission(PERM_ITEM) && !sender.hasPermission("escapezcore.admin")) {
            return Collections.emptyList();
        }
        if (args.length == 1) {
            return filter(List.of("list", "info", "give", "get", "gui"), args[0]);
        }
        String sub = args[0].toLowerCase(Locale.ROOT);
        if (args.length == 2 && (sub.equals("give") || sub.equals("get") || sub.equals("info"))) {
            return filter(new ArrayList<>(items.ids()), args[1]);
        }
        if (args.length == 3 && sub.equals("give")) {
            List<String> names = Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .collect(Collectors.toCollection(ArrayList::new));
            names.add("1");
            names.add("16");
            names.add("64");
            return filter(names, args[2]);
        }
        if (args.length == 4 && sub.equals("give")) {
            return filter(List.of("1", "16", "32", "64"), args[3]);
        }
        if (args.length == 3 && sub.equals("get")) {
            return filter(List.of("1", "16", "32", "64"), args[2]);
        }
        return Collections.emptyList();
    }

    private static List<String> filter(List<String> opts, String prefix) {
        String p = prefix == null ? "" : prefix.toLowerCase(Locale.ROOT);
        return opts.stream()
                .filter(s -> s.toLowerCase(Locale.ROOT).startsWith(p))
                .sorted()
                .collect(Collectors.toList());
    }

    private static int parseAmount(String raw) {
        try {
            return Math.max(1, Math.min(64, Integer.parseInt(raw)));
        } catch (NumberFormatException ex) {
            return 1;
        }
    }

    private static boolean isInt(String raw) {
        try {
            Integer.parseInt(raw);
            return true;
        } catch (NumberFormatException ex) {
            return false;
        }
    }
}

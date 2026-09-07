package be.escapezcraft.escapezcore.staffchat;

import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.Collections;
import java.util.List;
import java.util.Map;

/**
 * /sc — toggle mode (no args) or one-shot message.
 */
public final class StaffChatCommand implements CommandExecutor, TabCompleter {

    private final StaffChatModule module;
    private final MessagesService messages;

    public StaffChatCommand(StaffChatModule module, MessagesService messages) {
        this.module = module;
        this.messages = messages;
    }

    @Override
    public boolean onCommand(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String label,
            @NotNull String[] args
    ) {
        if (!(sender instanceof Player player)) {
            messages.send(sender, "player-only");
            return true;
        }
        if (!player.hasPermission(StaffChatModule.PERMISSION)) {
            messages.send(sender, "no-permission");
            return true;
        }
        if (!module.isFeatureEnabled()) {
            messages.send(sender, "staffchat-disabled");
            return true;
        }

        if (args.length == 0) {
            boolean nowOn = module.toggle(player);
            messages.send(player, nowOn ? "staffchat-toggle-on" : "staffchat-toggle-off");
            return true;
        }

        String message = String.join(" ", args).trim();
        if (message.isEmpty()) {
            messages.send(player, "staffchat-usage");
            return true;
        }
        module.broadcastPlain(player, message);
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String alias,
            @NotNull String[] args
    ) {
        return Collections.emptyList();
    }
}

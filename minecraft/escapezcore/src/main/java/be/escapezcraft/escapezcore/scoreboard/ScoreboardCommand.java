package be.escapezcraft.escapezcore.scoreboard;

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
 * /sb and /ec scoreboard — toggle sidebar visibility.
 */
public final class ScoreboardCommand implements CommandExecutor, TabCompleter {

    private final ScoreboardModule module;
    private final MessagesService messages;

    public ScoreboardCommand(ScoreboardModule module, MessagesService messages) {
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
        return handle(sender);
    }

    public boolean handle(CommandSender sender) {
        if (!(sender instanceof Player player)) {
            messages.send(sender, "player-only");
            return true;
        }
        ScoreboardService service = module.getService();
        if (service == null || !service.isFeatureEnabled()) {
            messages.send(player, "scoreboard-disabled");
            return true;
        }
        if (!service.isToggleEnabled()) {
            messages.send(player, "scoreboard-toggle-disabled");
            return true;
        }
        String perm = service.getTogglePermission();
        if (perm != null && !perm.isBlank() && !player.hasPermission(perm)) {
            messages.send(player, "no-permission");
            return true;
        }
        boolean visible = service.toggle(player);
        messages.send(player, visible ? "scoreboard-on" : "scoreboard-off", Map.of(
                "state", visible ? "aan" : "uit"
        ));
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

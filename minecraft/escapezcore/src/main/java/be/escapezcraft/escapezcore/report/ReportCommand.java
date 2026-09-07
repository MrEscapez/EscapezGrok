package be.escapezcraft.escapezcore.report;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.Bukkit;
import org.bukkit.command.Command;
import org.bukkit.command.CommandExecutor;
import org.bukkit.command.CommandSender;
import org.bukkit.command.TabCompleter;
import org.bukkit.entity.Player;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * /report &lt;speler&gt; &lt;reden&gt; — also used by /ec report.
 */
public final class ReportCommand implements CommandExecutor, TabCompleter {

    private final EscapezCorePlugin plugin;
    private final MessagesService messages;
    private final ReportService service;

    public ReportCommand(EscapezCorePlugin plugin, MessagesService messages, ReportService service) {
        this.plugin = plugin;
        this.messages = messages;
        this.service = service;
    }

    @Override
    public boolean onCommand(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String label,
            @NotNull String[] args
    ) {
        return handle(sender, args);
    }

    /**
     * Shared entry for /report and /ec report.
     */
    public boolean handle(CommandSender sender, String[] args) {
        if (!(sender instanceof Player player)) {
            messages.send(sender, "player-only");
            return true;
        }
        if (!sender.hasPermission(ReportService.REPORT_PERMISSION)) {
            messages.send(sender, "no-permission");
            return true;
        }
        if (!service.isEnabled()) {
            messages.send(sender, "report-disabled");
            return true;
        }
        if (!service.isReady()) {
            messages.send(sender, "report-not-ready");
            return true;
        }
        if (args.length < 2) {
            messages.send(sender, "report-usage");
            return true;
        }

        String targetName = args[0];
        Player target = Bukkit.getPlayerExact(targetName);
        if (target == null) {
            // Try case-insensitive online match
            for (Player online : Bukkit.getOnlinePlayers()) {
                if (online.getName().equalsIgnoreCase(targetName)) {
                    target = online;
                    break;
                }
            }
        }
        if (target == null) {
            messages.send(sender, "report-player-not-found", Map.of("player", targetName));
            return true;
        }
        if (target.getUniqueId().equals(player.getUniqueId())) {
            messages.send(sender, "report-self");
            return true;
        }

        int remaining = service.checkCooldown(player);
        if (remaining > 0) {
            messages.send(sender, "cooldown", Map.of("seconds", String.valueOf(remaining)));
            return true;
        }

        StringBuilder reasonBuilder = new StringBuilder();
        for (int i = 1; i < args.length; i++) {
            if (i > 1) {
                reasonBuilder.append(' ');
            }
            reasonBuilder.append(args[i]);
        }
        String reason = reasonBuilder.toString().trim();
        if (reason.isEmpty()) {
            messages.send(sender, "report-usage");
            return true;
        }
        if (reason.length() < 3) {
            messages.send(sender, "report-reason-short");
            return true;
        }

        service.applyCooldown(player);
        messages.send(sender, "report-pending");

        final Player finalTarget = target;
        service.submit(player, finalTarget, reason).whenComplete((report, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null || report == null) {
                        messages.send(player, "report-failed");
                        plugin.getLogger().warning("Report create failed for "
                                + player.getUniqueId() + ": "
                                + (err == null ? "null" : err.getMessage()));
                        return;
                    }
                    messages.send(player, "report-success", Map.of(
                            "id", String.valueOf(report.id()),
                            "target", report.targetName()
                    ));
                }));
        return true;
    }

    @Override
    public @Nullable List<String> onTabComplete(
            @NotNull CommandSender sender,
            @NotNull Command command,
            @NotNull String alias,
            @NotNull String[] args
    ) {
        return tabComplete(sender, args);
    }

    public List<String> tabComplete(CommandSender sender, String[] args) {
        if (!sender.hasPermission(ReportService.REPORT_PERMISSION)) {
            return Collections.emptyList();
        }
        if (args.length == 1) {
            String prefix = args[0].toLowerCase(Locale.ROOT);
            return Bukkit.getOnlinePlayers().stream()
                    .map(Player::getName)
                    .filter(name -> name.toLowerCase(Locale.ROOT).startsWith(prefix))
                    .sorted()
                    .collect(Collectors.toCollection(ArrayList::new));
        }
        return Collections.emptyList();
    }
}

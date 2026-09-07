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

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.stream.Stream;

/**
 * Staff management: /reports … and /ec admin report …
 * Staff notes are only shown to staff (this command requires manage permission).
 */
public final class ReportStaffCommands implements CommandExecutor, TabCompleter {

    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm").withZone(ZoneId.of("Europe/Brussels"));

    private final EscapezCorePlugin plugin;
    private final MessagesService messages;
    private final ReportService service;

    public ReportStaffCommands(EscapezCorePlugin plugin, MessagesService messages, ReportService service) {
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

    public boolean handle(CommandSender sender, String[] args) {
        if (!sender.hasPermission(ReportService.MANAGE_PERMISSION)
                && !sender.hasPermission("escapezcore.admin")
                && !sender.hasPermission("escapezcore.staff")) {
            messages.send(sender, "no-permission");
            return true;
        }
        if (!service.isEnabled()) {
            messages.send(sender, "report-disabled");
            return true;
        }
        if (args.length == 0) {
            messages.send(sender, "report-staff-usage");
            return true;
        }

        String action = args[0].toLowerCase(Locale.ROOT);
        return switch (action) {
            case "list" -> doList(sender, args);
            case "view", "info" -> doView(sender, args);
            case "claim" -> doClaim(sender, args);
            case "resolve" -> doResolve(sender, args);
            case "dismiss" -> doDismiss(sender, args);
            case "note" -> doNote(sender, args);
            default -> {
                messages.send(sender, "report-staff-usage");
                yield true;
            }
        };
    }

    private boolean doList(CommandSender sender, String[] args) {
        ReportStatus filter = null;
        int page = 0;
        if (args.length >= 2) {
            String second = args[1];
            try {
                page = Math.max(0, Integer.parseInt(second) - 1);
            } catch (NumberFormatException ex) {
                try {
                    filter = ReportStatus.fromString(second);
                } catch (IllegalArgumentException iae) {
                    messages.send(sender, "report-invalid-status", Map.of("status", second));
                    return true;
                }
                if (args.length >= 3) {
                    try {
                        page = Math.max(0, Integer.parseInt(args[2]) - 1);
                    } catch (NumberFormatException ignored) {
                        page = 0;
                    }
                }
            }
        }
        final ReportStatus statusFilter = filter;
        final int pageNum = page;
        service.list(statusFilter, pageNum).whenComplete((list, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null) {
                        messages.send(sender, "report-failed");
                        return;
                    }
                    String statusLabel = statusFilter == null ? "alle" : statusFilter.displayDutch();
                    messages.send(sender, "report-list-header", Map.of(
                            "page", String.valueOf(pageNum + 1),
                            "status", statusLabel,
                            "count", String.valueOf(list.size())
                    ));
                    if (list.isEmpty()) {
                        messages.send(sender, "report-list-empty");
                        return;
                    }
                    for (Report report : list) {
                        messages.sendRaw(sender, "report-list-line", Map.of(
                                "id", String.valueOf(report.id()),
                                "status", report.status().displayDutch(),
                                "reporter", report.reporterName(),
                                "target", report.targetName(),
                                "reason", truncate(report.reason(), 40)
                        ));
                    }
                }));
        return true;
    }

    private boolean doView(CommandSender sender, String[] args) {
        Long id = parseId(sender, args, 1);
        if (id == null) {
            return true;
        }
        service.find(id).whenComplete((opt, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null || opt == null || opt.isEmpty()) {
                        messages.send(sender, "report-not-found", Map.of("id", String.valueOf(id)));
                        return;
                    }
                    sendView(sender, opt.get());
                }));
        return true;
    }

    private void sendView(CommandSender sender, Report report) {
        messages.send(sender, "report-view-header", Map.of("id", String.valueOf(report.id())));
        messages.sendRaw(sender, "report-view-line", Map.of(
                "label", "Status",
                "value", report.status().displayDutch()
        ));
        messages.sendRaw(sender, "report-view-line", Map.of(
                "label", "Melder",
                "value", report.reporterName() + " (" + report.reporterUuid() + ")"
        ));
        messages.sendRaw(sender, "report-view-line", Map.of(
                "label", "Doelwit",
                "value", report.targetName() + " (" + report.targetUuid() + ")"
        ));
        messages.sendRaw(sender, "report-view-line", Map.of(
                "label", "Reden",
                "value", report.reason()
        ));
        messages.sendRaw(sender, "report-view-line", Map.of(
                "label", "Aangemaakt",
                "value", TIME_FMT.format(report.createdAt()) + " (Brussels)"
        ));
        String claimed = report.claimedByName() == null
                ? "—"
                : report.claimedByName() + (report.claimedByUuid() == null ? "" : " (" + report.claimedByUuid() + ")");
        messages.sendRaw(sender, "report-view-line", Map.of("label", "Geclaimd door", "value", claimed));
        // Staff notes — staff-only visibility (this command is staff-gated)
        String notes = report.staffNotes();
        messages.sendRaw(sender, "report-view-notes", Map.of(
                "notes", notes == null || notes.isBlank() ? "—" : notes
        ));
    }

    private boolean doClaim(CommandSender sender, String[] args) {
        Long id = parseId(sender, args, 1);
        if (id == null) {
            return true;
        }
        java.util.UUID uuid;
        String name;
        if (sender instanceof Player player) {
            uuid = player.getUniqueId();
            name = player.getName();
        } else {
            uuid = new java.util.UUID(0L, 0L);
            name = "Console";
        }
        service.claim(id, uuid, name).whenComplete((opt, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null || opt == null || opt.isEmpty()) {
                        messages.send(sender, "report-not-found", Map.of("id", String.valueOf(id)));
                        return;
                    }
                    Report report = opt.get();
                    if (report.status() == ReportStatus.RESOLVED || report.status() == ReportStatus.DISMISSED) {
                        messages.send(sender, "report-already-closed", Map.of(
                                "id", String.valueOf(id),
                                "status", report.status().displayDutch()
                        ));
                        return;
                    }
                    messages.send(sender, "report-claimed", Map.of(
                            "id", String.valueOf(report.id()),
                            "staff", name
                    ));
                }));
        return true;
    }

    private boolean doResolve(CommandSender sender, String[] args) {
        Long id = parseId(sender, args, 1);
        if (id == null) {
            return true;
        }
        service.resolve(id).whenComplete((opt, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null || opt == null || opt.isEmpty()) {
                        messages.send(sender, "report-not-found", Map.of("id", String.valueOf(id)));
                        return;
                    }
                    messages.send(sender, "report-resolved", Map.of("id", String.valueOf(id)));
                }));
        return true;
    }

    private boolean doDismiss(CommandSender sender, String[] args) {
        Long id = parseId(sender, args, 1);
        if (id == null) {
            return true;
        }
        service.dismiss(id).whenComplete((opt, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null || opt == null || opt.isEmpty()) {
                        messages.send(sender, "report-not-found", Map.of("id", String.valueOf(id)));
                        return;
                    }
                    messages.send(sender, "report-dismissed", Map.of("id", String.valueOf(id)));
                }));
        return true;
    }

    private boolean doNote(CommandSender sender, String[] args) {
        Long id = parseId(sender, args, 1);
        if (id == null) {
            return true;
        }
        if (args.length < 3) {
            messages.send(sender, "report-note-usage");
            return true;
        }
        String note = String.join(" ", Arrays.copyOfRange(args, 2, args.length)).trim();
        if (note.isEmpty()) {
            messages.send(sender, "report-note-usage");
            return true;
        }
        String who = sender instanceof Player p ? p.getName() : "Console";
        String stamped = "[" + who + "] " + note;
        service.addNote(id, stamped).whenComplete((opt, err) ->
                Bukkit.getScheduler().runTask(plugin, () -> {
                    if (err != null || opt == null || opt.isEmpty()) {
                        messages.send(sender, "report-not-found", Map.of("id", String.valueOf(id)));
                        return;
                    }
                    messages.send(sender, "report-note-added", Map.of("id", String.valueOf(id)));
                }));
        return true;
    }

    private Long parseId(CommandSender sender, String[] args, int index) {
        if (args.length <= index) {
            messages.send(sender, "report-staff-usage");
            return null;
        }
        try {
            long id = Long.parseLong(args[index]);
            if (id <= 0) {
                throw new NumberFormatException("non-positive");
            }
            return id;
        } catch (NumberFormatException ex) {
            messages.send(sender, "report-invalid-id", Map.of("id", args[index]));
            return null;
        }
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "";
        }
        return value.length() <= max ? value : value.substring(0, max - 1) + "…";
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
        if (!sender.hasPermission(ReportService.MANAGE_PERMISSION)
                && !sender.hasPermission("escapezcore.admin")
                && !sender.hasPermission("escapezcore.staff")) {
            return Collections.emptyList();
        }
        if (args.length == 1) {
            String prefix = args[0].toLowerCase(Locale.ROOT);
            return Stream.of("list", "view", "claim", "resolve", "dismiss", "note")
                    .filter(s -> s.startsWith(prefix))
                    .collect(Collectors.toList());
        }
        if (args.length == 2 && args[0].equalsIgnoreCase("list")) {
            String prefix = args[1].toLowerCase(Locale.ROOT);
            List<String> opts = new ArrayList<>();
            for (ReportStatus status : ReportStatus.values()) {
                String name = status.name().toLowerCase(Locale.ROOT);
                if (name.startsWith(prefix)) {
                    opts.add(name);
                }
            }
            return opts;
        }
        return Collections.emptyList();
    }
}

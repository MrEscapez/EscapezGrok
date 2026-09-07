package be.escapezcraft.escapezcore.report;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.command.CooldownService;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.messages.MessagesService;
import org.bukkit.Bukkit;
import org.bukkit.entity.Player;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Level;

/**
 * Business logic for creating and managing player reports.
 */
public final class ReportService {

    public static final String REPORT_PERMISSION = "escapezcore.command.report";
    public static final String MANAGE_PERMISSION = "escapezcore.report.manage";
    public static final String NOTIFY_PERMISSION = "escapezcore.report.notify";

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final CooldownService cooldowns;
    private ReportRepository repository;
    private final AtomicBoolean ready = new AtomicBoolean(false);

    public ReportService(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            CooldownService cooldowns
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.cooldowns = cooldowns;
    }

    public void setRepository(ReportRepository repository) {
        this.repository = repository;
        if (repository == null) {
            ready.set(false);
        }
    }

    public ReportRepository getRepository() {
        return repository;
    }

    /** True when repository schema/file load finished successfully (never block waiting for this). */
    public void setReady(boolean value) {
        ready.set(value);
    }

    public boolean isReady() {
        return ready.get() && repository != null;
    }

    public boolean isEnabled() {
        return configManager.getConfig().getBoolean("reports.enabled", true) && repository != null;
    }

    public int cooldownSeconds() {
        return configManager.getConfig().getInt("reports.cooldown-seconds", 60);
    }

    public int maxReasonLength() {
        return configManager.getConfig().getInt("reports.max-reason-length", 256);
    }

    public int listPageSize() {
        return configManager.getConfig().getInt("reports.list-page-size", 10);
    }

    public String notifyPermission() {
        return configManager.getConfig().getString("reports.notify-permission", NOTIFY_PERMISSION);
    }

    public CompletableFuture<Report> submit(Player reporter, Player target, String reason) {
        if (!isEnabled() || !isReady()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Reports not ready"));
        }
        String trimmed = reason == null ? "" : reason.trim();
        int max = maxReasonLength();
        if (trimmed.length() > max) {
            trimmed = trimmed.substring(0, max);
        }
        final String finalReason = trimmed;
        return repository.create(
                reporter.getUniqueId(),
                reporter.getName(),
                target.getUniqueId(),
                target.getName(),
                finalReason
        ).whenComplete((report, err) -> {
            if (err != null) {
                plugin.getLogger().log(Level.WARNING, "Report opslaan mislukt", err);
                return;
            }
            Bukkit.getScheduler().runTask(plugin, () -> notifyStaff(report));
        });
    }

    public int checkCooldown(Player player) {
        return cooldowns.remainingSeconds(player, "report", cooldownSeconds());
    }

    public void applyCooldown(Player player) {
        cooldowns.apply(player, "report", cooldownSeconds());
    }

    public CompletableFuture<Optional<Report>> find(long id) {
        if (!isReady()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Reports not ready"));
        }
        return repository.findById(id);
    }

    public CompletableFuture<List<Report>> list(ReportStatus status, int page) {
        if (!isReady()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Reports not ready"));
        }
        int size = listPageSize();
        int offset = Math.max(0, page) * size;
        return repository.list(status, offset, size);
    }

    public CompletableFuture<Optional<Report>> claim(long id, UUID staffUuid, String staffName) {
        if (!isReady()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Reports not ready"));
        }
        return repository.findById(id).thenCompose(opt -> {
            if (opt.isEmpty()) {
                return CompletableFuture.completedFuture(Optional.empty());
            }
            Report current = opt.get();
            if (current.status() == ReportStatus.RESOLVED || current.status() == ReportStatus.DISMISSED) {
                return CompletableFuture.completedFuture(Optional.of(current));
            }
            Report updated = current.withClaim(staffUuid, staffName, Instant.now());
            return repository.update(updated).thenApply(ok -> ok ? Optional.of(updated) : Optional.empty());
        });
    }

    public CompletableFuture<Optional<Report>> resolve(long id) {
        return setStatus(id, ReportStatus.RESOLVED);
    }

    public CompletableFuture<Optional<Report>> dismiss(long id) {
        return setStatus(id, ReportStatus.DISMISSED);
    }

    public CompletableFuture<Optional<Report>> addNote(long id, String note) {
        if (!isReady()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Reports not ready"));
        }
        return repository.findById(id).thenCompose(opt -> {
            if (opt.isEmpty()) {
                return CompletableFuture.completedFuture(Optional.empty());
            }
            Report current = opt.get();
            String existing = current.staffNotes();
            String merged;
            if (existing == null || existing.isBlank()) {
                merged = note;
            } else {
                merged = existing + "\n" + note;
            }
            Report updated = current.withStaffNotes(merged, Instant.now());
            return repository.update(updated).thenApply(ok -> ok ? Optional.of(updated) : Optional.empty());
        });
    }

    private CompletableFuture<Optional<Report>> setStatus(long id, ReportStatus status) {
        if (!isReady()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Reports not ready"));
        }
        return repository.findById(id).thenCompose(opt -> {
            if (opt.isEmpty()) {
                return CompletableFuture.completedFuture(Optional.empty());
            }
            Report updated = opt.get().withStatus(status, Instant.now());
            return repository.update(updated).thenApply(ok -> ok ? Optional.of(updated) : Optional.empty());
        });
    }

    private void notifyStaff(Report report) {
        String perm = notifyPermission();
        Map<String, String> placeholders = Map.of(
                "id", String.valueOf(report.id()),
                "reporter", report.reporterName(),
                "target", report.targetName(),
                "reason", report.reason()
        );
        for (Player online : Bukkit.getOnlinePlayers()) {
            if (online.hasPermission(perm)) {
                messages.send(online, "report-notify", placeholders);
            }
        }
        plugin.getLogger().info("[Report #" + report.id() + "] "
                + report.reporterName() + " → " + report.targetName() + ": " + report.reason());
    }

    public String backendName() {
        return repository == null ? "none" : repository.backendName();
    }
}

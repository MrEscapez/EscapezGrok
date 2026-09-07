package be.escapezcraft.escapezcore.report;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import org.bukkit.Bukkit;
import org.bukkit.configuration.ConfigurationSection;
import org.bukkit.configuration.file.YamlConfiguration;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicLong;
import java.util.logging.Level;

/**
 * YAML file fallback for reports when neither PostgreSQL nor SQLite is available.
 * All I/O runs off the main thread; writes use temp-file + atomic move.
 */
public final class FileReportRepository implements ReportRepository {

    private final EscapezCorePlugin plugin;
    private final File file;
    private final Executor async;
    private final Object lock = new Object();
    private final AtomicLong nextId = new AtomicLong(1);
    private final List<Report> cache = new ArrayList<>();

    public FileReportRepository(EscapezCorePlugin plugin, File file) {
        this.plugin = plugin;
        this.file = file;
        this.async = runnable -> Bukkit.getScheduler().runTaskAsynchronously(plugin, runnable);
    }

    @Override
    public String backendName() {
        return "file";
    }

    @Override
    public CompletableFuture<Void> initialize() {
        return CompletableFuture.runAsync(() -> {
            synchronized (lock) {
                loadLocked();
            }
        }, async);
    }

    @Override
    public CompletableFuture<Report> create(
            UUID reporterUuid,
            String reporterName,
            UUID targetUuid,
            String targetName,
            String reason
    ) {
        return CompletableFuture.supplyAsync(() -> {
            synchronized (lock) {
                Instant now = Instant.now();
                long id = nextId.getAndIncrement();
                Report report = new Report(
                        id, reporterUuid, safeName(reporterName), targetUuid, safeName(targetName),
                        reason, ReportStatus.OPEN, null, null, null, now, now, null);
                cache.add(report);
                saveLocked();
                return report;
            }
        }, async);
    }

    @Override
    public CompletableFuture<Optional<Report>> findById(long id) {
        return CompletableFuture.supplyAsync(() -> {
            synchronized (lock) {
                return cache.stream().filter(r -> r.id() == id).findFirst();
            }
        }, async);
    }

    @Override
    public CompletableFuture<List<Report>> list(ReportStatus status, int offset, int limit) {
        return CompletableFuture.supplyAsync(() -> {
            synchronized (lock) {
                return cache.stream()
                        .filter(r -> status == null || r.status() == status)
                        .sorted(Comparator.comparing(Report::createdAt).reversed())
                        .skip(Math.max(0, offset))
                        .limit(Math.max(1, limit))
                        .toList();
            }
        }, async);
    }

    @Override
    public CompletableFuture<Boolean> update(Report report) {
        return CompletableFuture.supplyAsync(() -> {
            synchronized (lock) {
                for (int i = 0; i < cache.size(); i++) {
                    if (cache.get(i).id() == report.id()) {
                        cache.set(i, report);
                        saveLocked();
                        return true;
                    }
                }
                return false;
            }
        }, async);
    }

    @Override
    public CompletableFuture<Void> close() {
        return CompletableFuture.runAsync(() -> {
            synchronized (lock) {
                saveLocked();
            }
        }, async);
    }

    private void loadLocked() {
        cache.clear();
        long maxId = 0;
        if (!file.exists()) {
            File parent = file.getParentFile();
            if (parent != null && !parent.exists() && !parent.mkdirs()) {
                plugin.getLogger().warning("Kon reports map niet aanmaken: " + parent);
            }
            nextId.set(1);
            return;
        }
        YamlConfiguration yaml = YamlConfiguration.loadConfiguration(file);
        ConfigurationSection section = yaml.getConfigurationSection("reports");
        if (section != null) {
            for (String key : section.getKeys(false)) {
                ConfigurationSection row = section.getConfigurationSection(key);
                if (row == null) {
                    continue;
                }
                try {
                    Report report = fromSection(row);
                    cache.add(report);
                    maxId = Math.max(maxId, report.id());
                } catch (Exception ex) {
                    plugin.getLogger().log(Level.WARNING, "Ongeldige report-entry: " + key, ex);
                }
            }
        }
        nextId.set(Math.max(1, maxId + 1));
    }

    private void saveLocked() {
        YamlConfiguration yaml = new YamlConfiguration();
        yaml.options().setHeader(List.of(
                "EscapezCore player reports (file fallback).",
                "Handmatige edits alleen bij stilstaande server."
        ));
        int i = 0;
        for (Report report : cache) {
            String path = "reports." + report.id();
            yaml.set(path + ".id", report.id());
            yaml.set(path + ".reporter-uuid", report.reporterUuid().toString());
            yaml.set(path + ".reporter-name", report.reporterName());
            yaml.set(path + ".target-uuid", report.targetUuid().toString());
            yaml.set(path + ".target-name", report.targetName());
            yaml.set(path + ".reason", report.reason());
            yaml.set(path + ".status", report.status().name());
            yaml.set(path + ".staff-notes", report.staffNotes());
            yaml.set(path + ".claimed-by-uuid",
                    report.claimedByUuid() == null ? null : report.claimedByUuid().toString());
            yaml.set(path + ".claimed-by-name", report.claimedByName());
            yaml.set(path + ".created-at", report.createdAt().toString());
            yaml.set(path + ".updated-at", report.updatedAt().toString());
            yaml.set(path + ".resolved-at",
                    report.resolvedAt() == null ? null : report.resolvedAt().toString());
            i++;
        }
        yaml.set("meta.count", i);
        yaml.set("meta.next-id", nextId.get());

        File parent = file.getParentFile();
        if (parent != null && !parent.exists() && !parent.mkdirs()) {
            plugin.getLogger().warning("Kon reports map niet aanmaken bij save: " + parent);
            return;
        }
        File tmp = new File(file.getParentFile(), file.getName() + ".tmp");
        try {
            yaml.save(tmp);
            Files.move(tmp.toPath(), file.toPath(),
                    StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } catch (IOException moveEx) {
            try {
                Files.move(tmp.toPath(), file.toPath(), StandardCopyOption.REPLACE_EXISTING);
            } catch (IOException ex) {
                plugin.getLogger().log(Level.SEVERE, "Kon reports.yml niet opslaan", ex);
            }
        }
    }

    private static Report fromSection(ConfigurationSection row) {
        String claimed = row.getString("claimed-by-uuid");
        String resolved = row.getString("resolved-at");
        return new Report(
                row.getLong("id"),
                UUID.fromString(row.getString("reporter-uuid")),
                row.getString("reporter-name", "?"),
                UUID.fromString(row.getString("target-uuid")),
                row.getString("target-name", "?"),
                row.getString("reason", ""),
                ReportStatus.fromString(row.getString("status")),
                row.getString("staff-notes"),
                claimed == null || claimed.isBlank() ? null : UUID.fromString(claimed),
                row.getString("claimed-by-name"),
                Instant.parse(row.getString("created-at", Instant.EPOCH.toString())),
                Instant.parse(row.getString("updated-at", Instant.EPOCH.toString())),
                resolved == null || resolved.isBlank() ? null : Instant.parse(resolved)
        );
    }

    private static String safeName(String name) {
        if (name == null || name.isBlank()) {
            return "?";
        }
        return name.length() <= 16 ? name : name.substring(0, 16);
    }
}

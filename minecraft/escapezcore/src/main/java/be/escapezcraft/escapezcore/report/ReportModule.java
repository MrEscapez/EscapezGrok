package be.escapezcraft.escapezcore.report;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.command.CooldownService;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.database.DatabaseModule;
import be.escapezcraft.escapezcore.messages.MessagesService;
import be.escapezcraft.escapezcore.module.Module;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import java.io.File;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.logging.Level;

/**
 * Owns Minecraft player reports: repository selection (PG → SQLite → file) and service.
 * Repository init is always asynchronous — never block the Paper main thread with join/get.
 */
public final class ReportModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final DatabaseModule databaseModule;
    private final CooldownService cooldownService;
    private final ReportService service;
    private final AtomicInteger initGeneration = new AtomicInteger(0);
    private HikariDataSource sqlitePool;
    private volatile ReportRepository repository;

    public ReportModule(
            EscapezCorePlugin plugin,
            ConfigManager configManager,
            MessagesService messages,
            DatabaseModule databaseModule,
            CooldownService cooldownService
    ) {
        this.plugin = plugin;
        this.configManager = configManager;
        this.messages = messages;
        this.databaseModule = databaseModule;
        this.cooldownService = cooldownService;
        this.service = new ReportService(plugin, configManager, messages, cooldownService);
    }

    @Override
    public String getName() {
        return "ReportModule";
    }

    @Override
    public void enable() {
        if (!configManager.getConfig().getBoolean("reports.enabled", true)) {
            plugin.getLogger().info("Reports uitgeschakeld in config.");
            service.setReady(false);
            return;
        }
        service.setReady(false);
        int generation = initGeneration.incrementAndGet();
        this.repository = openRepository();
        service.setRepository(repository);
        beginInitialize(repository, generation, true);
        // Must return without blocking — init continues asynchronously.
    }

    /**
     * Starts async schema/file load. Never calls {@code join()}/{@code get()} on the server thread.
     */
    private void beginInitialize(ReportRepository repo, int generation, boolean allowFileFallback) {
        final ReportRepository expected = repo;
        repo.initialize().whenComplete((ignored, error) -> {
            if (generation != initGeneration.get() || this.repository != expected) {
                return; // disabled or replaced mid-init
            }
            if (error != null) {
                plugin.getLogger().log(Level.SEVERE,
                        "Report repository init mislukt"
                                + (allowFileFallback ? " — file fallback" : ""),
                        error);
                if (!allowFileFallback) {
                    service.setReady(false);
                    return;
                }
                closeSqliteQuietly();
                File file = new File(plugin.getDataFolder(), "reports.yml");
                FileReportRepository fallback = new FileReportRepository(plugin, file);
                this.repository = fallback;
                service.setRepository(fallback);
                beginInitialize(fallback, generation, false);
                return;
            }
            service.setReady(true);
            plugin.getLogger().info("Reports actief (backend=" + expected.backendName() + ").");
        });
    }

    private ReportRepository openRepository() {
        String mode = configManager.getConfig().getString("reports.persistence", "auto");
        if (mode == null) {
            mode = "auto";
        }
        mode = mode.toLowerCase();

        if ("postgres".equals(mode) || "postgresql".equals(mode) || "auto".equals(mode)) {
            if (databaseModule != null && databaseModule.isEnabled()) {
                plugin.getLogger().info("Reports gebruiken PostgreSQL via DatabaseModule.");
                return new JdbcReportRepository(
                        plugin, databaseModule.getDataSource(), JdbcReportRepository.Dialect.POSTGRES);
            }
            if ("postgres".equals(mode) || "postgresql".equals(mode)) {
                plugin.getLogger().warning(
                        "reports.persistence=postgres maar database niet beschikbaar — val terug.");
            }
        }

        if ("file".equals(mode)) {
            return new FileReportRepository(plugin, new File(plugin.getDataFolder(), "reports.yml"));
        }

        // sqlite (default fallback for auto / sqlite)
        try {
            File dbFile = new File(plugin.getDataFolder(), "reports.db");
            File parent = dbFile.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }
            HikariConfig hikari = new HikariConfig();
            hikari.setJdbcUrl("jdbc:sqlite:" + dbFile.getAbsolutePath());
            hikari.setMaximumPoolSize(2);
            hikari.setPoolName("EscapezCore-Reports-SQLite");
            hikari.setConnectionTimeout(10_000);
            this.sqlitePool = new HikariDataSource(hikari);
            plugin.getLogger().info("Reports gebruiken lokale SQLite: " + dbFile.getName());
            return new JdbcReportRepository(plugin, sqlitePool, JdbcReportRepository.Dialect.SQLITE);
        } catch (Exception ex) {
            plugin.getLogger().log(Level.WARNING,
                    "SQLite reports mislukt — file fallback: " + ex.getMessage());
            closeSqliteQuietly();
            return new FileReportRepository(plugin, new File(plugin.getDataFolder(), "reports.yml"));
        }
    }

    @Override
    public void disable() {
        initGeneration.incrementAndGet(); // cancel in-flight init callbacks
        service.setReady(false);
        ReportRepository closing = this.repository;
        this.repository = null;
        service.setRepository(null);
        if (closing != null) {
            // Do not join — close may schedule Bukkit async I/O (file backend).
            closing.close().whenComplete((ignored, ex) -> {
                if (ex != null) {
                    plugin.getLogger().log(Level.WARNING, "Report repository close fout", ex);
                }
            });
        }
        closeSqliteQuietly();
    }

    @Override
    public void reload() {
        // Keep existing repository; config values (cooldown etc.) are read live from ConfigManager.
        plugin.getLogger().info("ReportModule herladen (backend=" + service.backendName()
                + ", ready=" + service.isReady() + ").");
    }

    private void closeSqliteQuietly() {
        if (sqlitePool != null) {
            try {
                sqlitePool.close();
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "SQLite pool close fout", ex);
            }
            sqlitePool = null;
        }
    }

    public ReportService getService() {
        return service;
    }

    public CooldownService getCooldownService() {
        return cooldownService;
    }
}

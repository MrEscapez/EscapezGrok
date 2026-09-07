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
import java.util.logging.Level;

/**
 * Owns Minecraft player reports: repository selection (PG → SQLite → file) and service.
 */
public final class ReportModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final MessagesService messages;
    private final DatabaseModule databaseModule;
    private final CooldownService cooldownService;
    private final ReportService service;
    private HikariDataSource sqlitePool;
    private ReportRepository repository;

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
            return;
        }
        this.repository = openRepository();
        service.setRepository(repository);
        try {
            repository.initialize().join();
            plugin.getLogger().info("Reports actief (backend=" + repository.backendName() + ").");
        } catch (Exception ex) {
            plugin.getLogger().log(Level.SEVERE, "Report repository init mislukt — file fallback", ex);
            closeSqliteQuietly();
            File file = new File(plugin.getDataFolder(), "reports.yml");
            this.repository = new FileReportRepository(plugin, file);
            service.setRepository(repository);
            repository.initialize().join();
            plugin.getLogger().info("Reports actief (backend=file, na fout).");
        }
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
        if (repository != null) {
            try {
                repository.close().join();
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "Report repository close fout", ex);
            }
            repository = null;
        }
        closeSqliteQuietly();
        service.setRepository(null);
    }

    @Override
    public void reload() {
        // Keep existing repository; config values (cooldown etc.) are read live from ConfigManager.
        plugin.getLogger().info("ReportModule herladen (backend=" + service.backendName() + ").");
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

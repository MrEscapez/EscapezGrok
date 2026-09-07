package be.escapezcraft.escapezcore.database;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.module.Module;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.bukkit.Bukkit;
import org.bukkit.configuration.file.FileConfiguration;

import java.sql.Connection;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.function.Function;
import java.util.logging.Level;

/**
 * Optional HikariCP skeleton. Plugin starts without PostgreSQL when disabled.
 * Never runs SQL on the main thread.
 */
public final class DatabaseModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private HikariDataSource dataSource;
    private boolean enabled;
    private Executor asyncExecutor;

    public DatabaseModule(EscapezCorePlugin plugin, ConfigManager configManager) {
        this.plugin = plugin;
        this.configManager = configManager;
    }

    @Override
    public String getName() {
        return "DatabaseModule";
    }

    @Override
    public void enable() {
        FileConfiguration cfg = configManager.getConfig();
        this.enabled = cfg.getBoolean("database.enabled", false);
        this.asyncExecutor = runnable -> Bukkit.getScheduler().runTaskAsynchronously(plugin, runnable);

        if (!enabled) {
            plugin.getLogger().info("Database disabled in config — starting without PostgreSQL.");
            return;
        }

        try {
            HikariConfig hikari = new HikariConfig();
            hikari.setJdbcUrl(cfg.getString("database.jdbc-url", "jdbc:postgresql://127.0.0.1:5432/escapezcraft"));
            hikari.setUsername(cfg.getString("database.username", "escapez"));
            // Password is set but NEVER logged
            hikari.setPassword(cfg.getString("database.password", ""));
            hikari.setMaximumPoolSize(cfg.getInt("database.pool-size", 5));
            hikari.setPoolName("EscapezCore-Hikari");
            hikari.setInitializationFailTimeout(-1); // don't block plugin start forever
            hikari.addDataSourceProperty("ApplicationName", "EscapezCore");

            this.dataSource = new HikariDataSource(hikari);
            plugin.getLogger().info("HikariCP pool created (credentials not logged).");
        } catch (Exception ex) {
            this.enabled = false;
            this.dataSource = null;
            plugin.getLogger().log(Level.WARNING,
                    "Database pool failed — continuing without database: " + ex.getMessage());
        }
    }

    @Override
    public void disable() {
        if (dataSource != null) {
            try {
                dataSource.close();
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "Error closing HikariCP", ex);
            }
            dataSource = null;
        }
        enabled = false;
    }

    @Override
    public void reload() {
        disable();
        enable();
    }

    public boolean isEnabled() {
        return enabled && dataSource != null && !dataSource.isClosed();
    }

    public HikariDataSource getDataSource() {
        return dataSource;
    }

    /**
     * Run JDBC work off the main thread. Identity uses UUID at call sites — never player names for DB keys.
     */
    public <T> CompletableFuture<T> supplyAsync(Function<Connection, T> work) {
        if (!isEnabled()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Database not enabled"));
        }
        if (Bukkit.isPrimaryThread()) {
            plugin.debugLog("Database work scheduled asynchronously (not on main thread).");
        }
        return CompletableFuture.supplyAsync(() -> {
            try (Connection connection = dataSource.getConnection()) {
                return work.apply(connection);
            } catch (Exception ex) {
                throw new RuntimeException("Async database error", ex);
            }
        }, asyncExecutor);
    }
}

package be.escapezcraft.escapezcore.database;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import be.escapezcraft.escapezcore.config.ConfigManager;
import be.escapezcraft.escapezcore.module.Module;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.bukkit.Bukkit;

import java.io.File;
import java.sql.Connection;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.logging.Level;

/**
 * HikariCP + Flyway database layer (FASE 6).
 * <p>
 * {@link #enable()} never blocks on migrations or connectivity checks — work runs async.
 * Callers must not {@code join()}/{@code get()} pool futures on the Paper main thread.
 * Secrets via {@code ESCAPEZ_DB_PASSWORD} (and optional URL/user env overrides); never logged.
 */
public final class DatabaseModule implements Module {

    private final EscapezCorePlugin plugin;
    private final ConfigManager configManager;
    private final AtomicInteger initGeneration = new AtomicInteger(0);
    private final AtomicBoolean ready = new AtomicBoolean(false);
    private final AtomicBoolean initializing = new AtomicBoolean(false);

    private volatile DatabaseSettings settings;
    private volatile HikariDataSource dataSource;
    private volatile boolean configured;
    private volatile CompletableFuture<Boolean> readyFuture = CompletableFuture.completedFuture(false);
    private Executor asyncExecutor;
    private MinecraftPlayerRepository playerRepository;
    private StaffChatLogRepository staffChatLogRepository;
    private McAuditRepository auditRepository;
    private PlayerPreferencesRepository preferencesRepository;
    private PlayerIdentityListener identityListener;

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
        this.asyncExecutor = runnable -> Bukkit.getScheduler().runTaskAsynchronously(plugin, runnable);
        this.settings = DatabaseSettings.fromConfig(configManager.getConfig());
        this.configured = settings.enabled();
        this.ready.set(false);
        this.initializing.set(false);

        if (!configured) {
            plugin.getLogger().info("Database uitgeschakeld in config — plugin start zonder centrale DB.");
            this.readyFuture = CompletableFuture.completedFuture(false);
            return;
        }

        int generation = initGeneration.incrementAndGet();
        this.initializing.set(true);
        CompletableFuture<Boolean> future = new CompletableFuture<>();
        this.readyFuture = future;

        plugin.getLogger().info("Database geconfigureerd (" + settings.safeSummary()
                + ") — pool + Flyway starten asynchroon…");

        // Pool creation + Flyway off the main thread — never join here.
        Bukkit.getScheduler().runTaskAsynchronously(plugin, () -> {
            if (generation != initGeneration.get()) {
                future.complete(false);
                return;
            }
            boolean ok = false;
            try {
                HikariDataSource ds = createPool(settings);
                if (generation != initGeneration.get()) {
                    closeQuietly(ds);
                    future.complete(false);
                    return;
                }
                this.dataSource = ds;
                if (settings.dialect() == DatabaseDialect.SQLITE) {
                    SqliteSchemaBootstrap.apply(ds, plugin.getLogger());
                } else {
                    FlywayMigrator.migrate(ds, settings.dialect(), plugin.getLogger());
                }
                if (generation != initGeneration.get()) {
                    closeQuietly(ds);
                    this.dataSource = null;
                    future.complete(false);
                    return;
                }
                wireRepositories(settings.dialect());
                registerIdentityListenerSyncSafe(generation);
                this.ready.set(true);
                ok = true;
                plugin.getLogger().info("Database klaar (Flyway OK, dialect="
                        + settings.dialect().name().toLowerCase() + ").");
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING,
                        "Database init/migratie mislukt — plugin blijft draaien zonder centrale DB: "
                                + ex.getMessage(),
                        ex);
                tearDownPoolOnly();
                this.ready.set(false);
                ok = false;
            } finally {
                this.initializing.set(false);
                future.complete(ok);
            }
        });
    }

    private HikariDataSource createPool(DatabaseSettings s) {
        HikariConfig hikari = new HikariConfig();
        if (s.dialect() == DatabaseDialect.SQLITE) {
            File dbFile = new File(plugin.getDataFolder(), s.sqliteFile());
            File parent = dbFile.getParentFile();
            if (parent != null && !parent.exists()) {
                //noinspection ResultOfMethodCallIgnored
                parent.mkdirs();
            }
            hikari.setJdbcUrl("jdbc:sqlite:" + dbFile.getAbsolutePath());
            hikari.setMaximumPoolSize(Math.min(4, s.maximumPoolSize()));
            hikari.setMinimumIdle(1);
        } else {
            hikari.setJdbcUrl(s.jdbcUrl());
            hikari.setUsername(s.username());
            hikari.setPassword(s.password()); // never logged
            hikari.setMaximumPoolSize(s.maximumPoolSize());
            hikari.setMinimumIdle(s.minimumIdle());
            hikari.addDataSourceProperty("ApplicationName", "EscapezCore");
        }

        hikari.setPoolName(s.poolName());
        hikari.setConnectionTimeout(s.connectionTimeoutMs());
        hikari.setIdleTimeout(s.idleTimeoutMs());
        hikari.setMaxLifetime(s.maxLifetimeMs());
        if (s.leakDetectionThresholdMs() > 0) {
            hikari.setLeakDetectionThreshold(s.leakDetectionThresholdMs());
        }
        // Do not fail plugin boot if DB is temporarily unreachable.
        hikari.setInitializationFailTimeout(-1);
        hikari.setAutoCommit(true);

        return new HikariDataSource(hikari);
    }

    private void wireRepositories(DatabaseDialect dialect) {
        this.playerRepository = new MinecraftPlayerRepository(plugin, this, dialect);
        this.staffChatLogRepository = new StaffChatLogRepository(plugin, this, dialect);
        this.auditRepository = new McAuditRepository(plugin, this, dialect);
        this.preferencesRepository = new PlayerPreferencesRepository(plugin, this, dialect);
    }

    private void registerIdentityListenerSyncSafe(int generation) {
        Bukkit.getScheduler().runTask(plugin, () -> {
            if (generation != initGeneration.get() || !ready.get() || dataSource == null) {
                return;
            }
            if (identityListener != null) {
                return;
            }
            identityListener = new PlayerIdentityListener(plugin, this);
            Bukkit.getPluginManager().registerEvents(identityListener, plugin);
        });
    }

    @Override
    public void disable() {
        initGeneration.incrementAndGet(); // cancel in-flight init
        ready.set(false);
        initializing.set(false);
        configured = false;
        identityListener = null;
        playerRepository = null;
        staffChatLogRepository = null;
        auditRepository = null;
        preferencesRepository = null;
        tearDownPoolOnly();
        readyFuture = CompletableFuture.completedFuture(false);
    }

    @Override
    public void reload() {
        disable();
        enable();
    }

    private void tearDownPoolOnly() {
        HikariDataSource ds = this.dataSource;
        this.dataSource = null;
        closeQuietly(ds);
    }

    private void closeQuietly(HikariDataSource ds) {
        if (ds == null) {
            return;
        }
        try {
            ds.close();
        } catch (Exception ex) {
            plugin.getLogger().log(Level.WARNING, "Fout bij sluiten van HikariCP-pool", ex);
        }
    }

    /**
     * True when {@code database.enabled} was set at last enable (pool may still be initializing).
     */
    public boolean isConfigured() {
        return configured;
    }

    /** True while async pool + Flyway init is in progress. */
    public boolean isInitializing() {
        return initializing.get();
    }

    /** True after successful Flyway migrate and pool is usable. */
    public boolean isReady() {
        return ready.get() && dataSource != null && !dataSource.isClosed();
    }

    /**
     * Back-compat: pool usable (ready). Prefer {@link #isReady()}.
     */
    public boolean isEnabled() {
        return isReady();
    }

    public DatabaseDialect getDialect() {
        return settings == null ? DatabaseDialect.POSTGRESQL : settings.dialect();
    }

    public DatabaseSettings getSettings() {
        return settings;
    }

    public HikariDataSource getDataSource() {
        return dataSource;
    }

    public MinecraftPlayerRepository getPlayerRepository() {
        return playerRepository;
    }

    public StaffChatLogRepository getStaffChatLogRepository() {
        return staffChatLogRepository;
    }

    public McAuditRepository getAuditRepository() {
        return auditRepository;
    }

    public PlayerPreferencesRepository getPreferencesRepository() {
        return preferencesRepository;
    }

    /**
     * Completes with {@code true} when DB is ready, {@code false} when disabled or init failed.
     * Never block the main thread on this future.
     */
    public CompletableFuture<Boolean> readyFuture() {
        return readyFuture;
    }

    /**
     * Registers a callback invoked asynchronously when init finishes (or immediately if already done).
     * Never {@code join()} this from the main thread.
     */
    public void whenReady(Consumer<Boolean> callback) {
        if (callback == null) {
            return;
        }
        readyFuture.whenComplete((ok, err) -> {
            boolean success = err == null && Boolean.TRUE.equals(ok);
            if (asyncExecutor != null) {
                asyncExecutor.execute(() -> {
                    try {
                        callback.accept(success);
                    } catch (Exception ex) {
                        plugin.getLogger().log(Level.WARNING, "Database ready-callback fout", ex);
                    }
                });
            } else {
                callback.accept(success);
            }
        });
    }

    /**
     * Run JDBC work off the main thread. Identity uses UUID at call sites — never player names for DB keys.
     */
    public <T> CompletableFuture<T> supplyAsync(Function<Connection, T> work) {
        if (!isReady()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Database not ready"));
        }
        if (Bukkit.isPrimaryThread()) {
            plugin.debugLog("Database work scheduled asynchronously (not on main thread).");
        }
        final HikariDataSource ds = this.dataSource;
        if (ds == null || ds.isClosed()) {
            return CompletableFuture.failedFuture(new IllegalStateException("Database pool closed"));
        }
        return CompletableFuture.supplyAsync(() -> {
            try (Connection connection = ds.getConnection()) {
                return work.apply(connection);
            } catch (Exception ex) {
                throw new RuntimeException("Async database error", ex);
            }
        }, asyncExecutor);
    }
}

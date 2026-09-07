package be.escapezcraft.escapezcore.database;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.output.MigrateResult;

import javax.sql.DataSource;
import java.util.logging.Logger;

/**
 * Runs EscapezCore-owned Flyway migrations. History table is {@code escapez_schema_history}
 * so Staff Panel can share the same database without colliding on {@code flyway_schema_history}.
 */
public final class FlywayMigrator {

    public static final String HISTORY_TABLE = "escapez_schema_history";

    private FlywayMigrator() {
    }

    public static MigrateResult migrate(DataSource dataSource, DatabaseDialect dialect, Logger logger) {
        Flyway flyway = Flyway.configure()
                .dataSource(dataSource)
                .locations(dialect.flywayLocation())
                .table(HISTORY_TABLE)
                .baselineOnMigrate(true)
                .baselineVersion("0")
                .validateOnMigrate(true)
                .load();

        logger.info("Flyway migraties starten (location=" + dialect.flywayLocation()
                + ", history=" + HISTORY_TABLE + ")…");
        MigrateResult result = flyway.migrate();
        logger.info("Flyway klaar: migrationsExecuted=" + result.migrationsExecuted
                + ", targetSchemaVersion=" + result.targetSchemaVersion
                + ", success=" + result.success);
        return result;
    }
}

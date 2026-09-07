package be.escapezcraft.escapezcore.database;

import javax.sql.DataSource;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.logging.Logger;
import java.util.stream.Collectors;

/**
 * Dev SQLite bootstrap mirroring Flyway scripts under {@code db/migration/sqlite}.
 * Flyway 10 Community does not ship a SQLite database module in our dependency set;
 * PostgreSQL uses Flyway. History table name matches {@link FlywayMigrator#HISTORY_TABLE}.
 */
public final class SqliteSchemaBootstrap {

    private static final String[] SCRIPTS = {
            "V1__minecraft_players.sql",
            "V2__escapez_reports.sql",
            "V3__player_preferences.sql",
            "V4__command_cooldowns.sql",
            "V5__staff_chat_logs.sql",
            "V6__mc_audit_log.sql"
    };

    private SqliteSchemaBootstrap() {
    }

    public static void apply(DataSource dataSource, Logger logger) throws Exception {
        try (Connection connection = dataSource.getConnection()) {
            connection.setAutoCommit(false);
            ensureHistoryTable(connection);
            int applied = 0;
            for (String script : SCRIPTS) {
                String version = script.substring(1, script.indexOf("__"));
                if (isApplied(connection, version)) {
                    continue;
                }
                String sql = readClasspath("db/migration/sqlite/" + script);
                executeScript(connection, sql);
                recordApplied(connection, version, script);
                applied++;
            }
            connection.commit();
            logger.info("SQLite schema bootstrap klaar (scriptsApplied=" + applied
                    + ", history=" + FlywayMigrator.HISTORY_TABLE + ").");
        }
    }

    private static void ensureHistoryTable(Connection connection) throws Exception {
        try (Statement st = connection.createStatement()) {
            st.execute("""
                    CREATE TABLE IF NOT EXISTS escapez_schema_history (
                      installed_rank INTEGER NOT NULL,
                      version TEXT,
                      description TEXT,
                      type TEXT NOT NULL,
                      script TEXT NOT NULL,
                      checksum INTEGER,
                      installed_by TEXT NOT NULL,
                      installed_on TEXT NOT NULL,
                      execution_time INTEGER NOT NULL,
                      success INTEGER NOT NULL,
                      PRIMARY KEY (installed_rank)
                    )
                    """);
        }
    }

    private static boolean isApplied(Connection connection, String version) throws Exception {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT 1 FROM escapez_schema_history WHERE version = ? AND success = 1 LIMIT 1")) {
            ps.setString(1, version);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static void recordApplied(Connection connection, String version, String script) throws Exception {
        int rank;
        try (Statement st = connection.createStatement();
             ResultSet rs = st.executeQuery(
                     "SELECT COALESCE(MAX(installed_rank), 0) + 1 FROM escapez_schema_history")) {
            rs.next();
            rank = rs.getInt(1);
        }
        String description = script.contains("__")
                ? script.substring(script.indexOf("__") + 2).replace(".sql", "").replace('_', ' ')
                : script;
        try (PreparedStatement ps = connection.prepareStatement("""
                INSERT INTO escapez_schema_history
                (installed_rank, version, description, type, script, checksum, installed_by,
                 installed_on, execution_time, success)
                VALUES (?, ?, ?, 'SQL', ?, NULL, 'EscapezCore', ?, 0, 1)
                """)) {
            ps.setInt(1, rank);
            ps.setString(2, version);
            ps.setString(3, description);
            ps.setString(4, script);
            ps.setString(5, Instant.now().toString());
            ps.executeUpdate();
        }
    }

    private static void executeScript(Connection connection, String sql) throws Exception {
        List<String> statements = splitStatements(sql);
        try (Statement st = connection.createStatement()) {
            for (String statement : statements) {
                st.execute(statement);
            }
        }
    }

    private static List<String> splitStatements(String sql) {
        List<String> out = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        for (String line : sql.split("\n")) {
            String trimmed = line.trim();
            if (trimmed.startsWith("--") || trimmed.isEmpty()) {
                continue;
            }
            current.append(line).append('\n');
            if (trimmed.endsWith(";")) {
                String stmt = current.toString().trim();
                if (stmt.endsWith(";")) {
                    stmt = stmt.substring(0, stmt.length() - 1).trim();
                }
                if (!stmt.isEmpty()) {
                    out.add(stmt);
                }
                current.setLength(0);
            }
        }
        String tail = current.toString().trim();
        if (!tail.isEmpty()) {
            out.add(tail.endsWith(";") ? tail.substring(0, tail.length() - 1).trim() : tail);
        }
        return out;
    }

    private static String readClasspath(String path) throws Exception {
        ClassLoader cl = SqliteSchemaBootstrap.class.getClassLoader();
        try (InputStream in = cl.getResourceAsStream(path)) {
            if (in == null) {
                throw new IllegalStateException("Missing migration resource: " + path);
            }
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
                return reader.lines().collect(Collectors.joining("\n"));
            }
        }
    }
}

package be.escapezcraft.escapezcore.report;

import be.escapezcraft.escapezcore.EscapezCorePlugin;
import org.bukkit.Bukkit;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.sql.Timestamp;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.Executor;
import java.util.logging.Level;

/**
 * JDBC report store for PostgreSQL (Hikari) or SQLite. Prepared statements only; async I/O.
 */
public final class JdbcReportRepository implements ReportRepository {

    public enum Dialect {
        POSTGRES,
        SQLITE
    }

    private final EscapezCorePlugin plugin;
    private final DataSource dataSource;
    private final Dialect dialect;
    private final Executor async;

    public JdbcReportRepository(EscapezCorePlugin plugin, DataSource dataSource, Dialect dialect) {
        this.plugin = plugin;
        this.dataSource = dataSource;
        this.dialect = dialect;
        this.async = runnable -> Bukkit.getScheduler().runTaskAsynchronously(plugin, runnable);
    }

    @Override
    public String backendName() {
        return dialect == Dialect.POSTGRES ? "postgresql" : "sqlite";
    }

    @Override
    public CompletableFuture<Void> initialize() {
        return supplyAsync(connection -> {
            try (Statement st = connection.createStatement()) {
                if (dialect == Dialect.POSTGRES) {
                    st.execute("""
                            CREATE TABLE IF NOT EXISTS escapez_reports (
                              id BIGSERIAL PRIMARY KEY,
                              reporter_uuid UUID NOT NULL,
                              reporter_name VARCHAR(16) NOT NULL,
                              target_uuid UUID NOT NULL,
                              target_name VARCHAR(16) NOT NULL,
                              reason TEXT NOT NULL,
                              status VARCHAR(32) NOT NULL,
                              staff_notes TEXT,
                              claimed_by_uuid UUID,
                              claimed_by_name VARCHAR(16),
                              created_at TIMESTAMPTZ NOT NULL,
                              updated_at TIMESTAMPTZ NOT NULL,
                              resolved_at TIMESTAMPTZ
                            )
                            """);
                    st.execute("CREATE INDEX IF NOT EXISTS idx_escapez_reports_status ON escapez_reports(status)");
                    st.execute("CREATE INDEX IF NOT EXISTS idx_escapez_reports_created ON escapez_reports(created_at DESC)");
                } else {
                    st.execute("""
                            CREATE TABLE IF NOT EXISTS escapez_reports (
                              id INTEGER PRIMARY KEY AUTOINCREMENT,
                              reporter_uuid TEXT NOT NULL,
                              reporter_name TEXT NOT NULL,
                              target_uuid TEXT NOT NULL,
                              target_name TEXT NOT NULL,
                              reason TEXT NOT NULL,
                              status TEXT NOT NULL,
                              staff_notes TEXT,
                              claimed_by_uuid TEXT,
                              claimed_by_name TEXT,
                              created_at TEXT NOT NULL,
                              updated_at TEXT NOT NULL,
                              resolved_at TEXT
                            )
                            """);
                    st.execute("CREATE INDEX IF NOT EXISTS idx_escapez_reports_status ON escapez_reports(status)");
                    st.execute("CREATE INDEX IF NOT EXISTS idx_escapez_reports_created ON escapez_reports(created_at DESC)");
                }
            } catch (SQLException ex) {
                throw new RuntimeException("Report schema init failed", ex);
            }
            return null;
        });
    }

    @Override
    public CompletableFuture<Report> create(
            UUID reporterUuid,
            String reporterName,
            UUID targetUuid,
            String targetName,
            String reason
    ) {
        Instant now = Instant.now();
        return supplyAsync(connection -> {
            try {
                if (dialect == Dialect.POSTGRES) {
                    String sql = """
                            INSERT INTO escapez_reports
                            (reporter_uuid, reporter_name, target_uuid, target_name, reason, status,
                             staff_notes, claimed_by_uuid, claimed_by_name, created_at, updated_at, resolved_at)
                            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, NULL)
                            RETURNING id
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql)) {
                        bindCreate(ps, reporterUuid, reporterName, targetUuid, targetName, reason, now);
                        try (ResultSet rs = ps.executeQuery()) {
                            if (!rs.next()) {
                                throw new SQLException("No id returned for report insert");
                            }
                            long id = rs.getLong(1);
                            return new Report(id, reporterUuid, reporterName, targetUuid, targetName, reason,
                                    ReportStatus.OPEN, null, null, null, now, now, null);
                        }
                    }
                } else {
                    String sql = """
                            INSERT INTO escapez_reports
                            (reporter_uuid, reporter_name, target_uuid, target_name, reason, status,
                             staff_notes, claimed_by_uuid, claimed_by_name, created_at, updated_at, resolved_at)
                            VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?, ?, NULL)
                            """;
                    try (PreparedStatement ps = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                        bindCreate(ps, reporterUuid, reporterName, targetUuid, targetName, reason, now);
                        ps.executeUpdate();
                        try (ResultSet keys = ps.getGeneratedKeys()) {
                            if (!keys.next()) {
                                throw new SQLException("No id returned for report insert");
                            }
                            long id = keys.getLong(1);
                            return new Report(id, reporterUuid, reporterName, targetUuid, targetName, reason,
                                    ReportStatus.OPEN, null, null, null, now, now, null);
                        }
                    }
                }
            } catch (SQLException ex) {
                throw new RuntimeException("Report create failed", ex);
            }
        });
    }

    private void bindCreate(
            PreparedStatement ps,
            UUID reporterUuid,
            String reporterName,
            UUID targetUuid,
            String targetName,
            String reason,
            Instant now
    ) throws SQLException {
        setUuid(ps, 1, reporterUuid);
        ps.setString(2, truncate(reporterName, 16));
        setUuid(ps, 3, targetUuid);
        ps.setString(4, truncate(targetName, 16));
        ps.setString(5, reason);
        ps.setString(6, ReportStatus.OPEN.name());
        setInstant(ps, 7, now);
        setInstant(ps, 8, now);
    }

    @Override
    public CompletableFuture<Optional<Report>> findById(long id) {
        return supplyAsync(connection -> {
            String sql = "SELECT * FROM escapez_reports WHERE id = ?";
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                ps.setLong(1, id);
                try (ResultSet rs = ps.executeQuery()) {
                    if (rs.next()) {
                        return Optional.of(mapRow(rs));
                    }
                    return Optional.empty();
                }
            } catch (SQLException ex) {
                throw new RuntimeException("Report findById failed", ex);
            }
        });
    }

    @Override
    public CompletableFuture<List<Report>> list(ReportStatus status, int offset, int limit) {
        return supplyAsync(connection -> {
            String sql;
            if (status == null) {
                sql = "SELECT * FROM escapez_reports ORDER BY created_at DESC LIMIT ? OFFSET ?";
            } else {
                sql = "SELECT * FROM escapez_reports WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?";
            }
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                if (status == null) {
                    ps.setInt(1, Math.max(1, limit));
                    ps.setInt(2, Math.max(0, offset));
                } else {
                    ps.setString(1, status.name());
                    ps.setInt(2, Math.max(1, limit));
                    ps.setInt(3, Math.max(0, offset));
                }
                List<Report> out = new ArrayList<>();
                try (ResultSet rs = ps.executeQuery()) {
                    while (rs.next()) {
                        out.add(mapRow(rs));
                    }
                }
                return out;
            } catch (SQLException ex) {
                throw new RuntimeException("Report list failed", ex);
            }
        });
    }

    @Override
    public CompletableFuture<Boolean> update(Report report) {
        return supplyAsync(connection -> {
            String sql = """
                    UPDATE escapez_reports SET
                      status = ?, staff_notes = ?, claimed_by_uuid = ?, claimed_by_name = ?,
                      updated_at = ?, resolved_at = ?
                    WHERE id = ?
                    """;
            try (PreparedStatement ps = connection.prepareStatement(sql)) {
                ps.setString(1, report.status().name());
                if (report.staffNotes() == null) {
                    ps.setNull(2, Types.VARCHAR);
                } else {
                    ps.setString(2, report.staffNotes());
                }
                if (report.claimedByUuid() == null) {
                    setUuidNull(ps, 3);
                    ps.setNull(4, Types.VARCHAR);
                } else {
                    setUuid(ps, 3, report.claimedByUuid());
                    ps.setString(4, truncate(report.claimedByName(), 16));
                }
                setInstant(ps, 5, report.updatedAt());
                if (report.resolvedAt() == null) {
                    setInstantNull(ps, 6);
                } else {
                    setInstant(ps, 6, report.resolvedAt());
                }
                ps.setLong(7, report.id());
                return ps.executeUpdate() > 0;
            } catch (SQLException ex) {
                throw new RuntimeException("Report update failed", ex);
            }
        });
    }

    @Override
    public CompletableFuture<Void> close() {
        // Pool ownership lives elsewhere (DatabaseModule or ReportModule SQLite pool).
        return CompletableFuture.completedFuture(null);
    }

    private Report mapRow(ResultSet rs) throws SQLException {
        return new Report(
                rs.getLong("id"),
                readUuid(rs, "reporter_uuid"),
                rs.getString("reporter_name"),
                readUuid(rs, "target_uuid"),
                rs.getString("target_name"),
                rs.getString("reason"),
                ReportStatus.fromString(rs.getString("status")),
                rs.getString("staff_notes"),
                readUuidNullable(rs, "claimed_by_uuid"),
                rs.getString("claimed_by_name"),
                readInstant(rs, "created_at"),
                readInstant(rs, "updated_at"),
                readInstantNullable(rs, "resolved_at")
        );
    }

    private void setUuid(PreparedStatement ps, int index, UUID uuid) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            ps.setObject(index, uuid);
        } else {
            ps.setString(index, uuid.toString());
        }
    }

    private void setUuidNull(PreparedStatement ps, int index) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            ps.setObject(index, null);
        } else {
            ps.setNull(index, Types.VARCHAR);
        }
    }

    private void setInstant(PreparedStatement ps, int index, Instant instant) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            ps.setTimestamp(index, Timestamp.from(instant));
        } else {
            ps.setString(index, instant.toString());
        }
    }

    private void setInstantNull(PreparedStatement ps, int index) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            ps.setTimestamp(index, null);
        } else {
            ps.setNull(index, Types.VARCHAR);
        }
    }

    private UUID readUuid(ResultSet rs, String column) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            Object obj = rs.getObject(column);
            if (obj instanceof UUID u) {
                return u;
            }
            return UUID.fromString(String.valueOf(obj));
        }
        return UUID.fromString(rs.getString(column));
    }

    private UUID readUuidNullable(ResultSet rs, String column) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            Object obj = rs.getObject(column);
            if (obj == null) {
                return null;
            }
            if (obj instanceof UUID u) {
                return u;
            }
            return UUID.fromString(String.valueOf(obj));
        }
        String raw = rs.getString(column);
        return raw == null || raw.isBlank() ? null : UUID.fromString(raw);
    }

    private Instant readInstant(ResultSet rs, String column) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            Timestamp ts = rs.getTimestamp(column);
            return ts == null ? Instant.EPOCH : ts.toInstant();
        }
        String raw = rs.getString(column);
        return raw == null ? Instant.EPOCH : Instant.parse(raw);
    }

    private Instant readInstantNullable(ResultSet rs, String column) throws SQLException {
        if (dialect == Dialect.POSTGRES) {
            Timestamp ts = rs.getTimestamp(column);
            return ts == null ? null : ts.toInstant();
        }
        String raw = rs.getString(column);
        return raw == null || raw.isBlank() ? null : Instant.parse(raw);
    }

    private static String truncate(String value, int max) {
        if (value == null) {
            return "?";
        }
        return value.length() <= max ? value : value.substring(0, max);
    }

    private <T> CompletableFuture<T> supplyAsync(java.util.function.Function<Connection, T> work) {
        if (Bukkit.isPrimaryThread()) {
            plugin.debugLog("Report JDBC work scheduled asynchronously.");
        }
        return CompletableFuture.supplyAsync(() -> {
            try (Connection connection = dataSource.getConnection()) {
                return work.apply(connection);
            } catch (Exception ex) {
                plugin.getLogger().log(Level.WARNING, "Report JDBC error: " + ex.getMessage(), ex);
                throw new RuntimeException(ex);
            }
        }, async);
    }
}

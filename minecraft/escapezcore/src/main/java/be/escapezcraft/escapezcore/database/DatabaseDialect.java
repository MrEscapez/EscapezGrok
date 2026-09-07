package be.escapezcraft.escapezcore.database;

/**
 * JDBC dialect used by EscapezCore-owned schema (Flyway locations differ per dialect).
 */
public enum DatabaseDialect {
    POSTGRESQL("classpath:db/migration/postgresql"),
    SQLITE("classpath:db/migration/sqlite");

    private final String flywayLocation;

    DatabaseDialect(String flywayLocation) {
        this.flywayLocation = flywayLocation;
    }

    public String flywayLocation() {
        return flywayLocation;
    }

    public static DatabaseDialect fromConfig(String raw) {
        if (raw == null || raw.isBlank()) {
            return POSTGRESQL;
        }
        return switch (raw.trim().toLowerCase()) {
            case "sqlite", "sqllite" -> SQLITE;
            case "postgres", "postgresql", "pg" -> POSTGRESQL;
            default -> POSTGRESQL;
        };
    }
}

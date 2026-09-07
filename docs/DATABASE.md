# Database

Optional HikariCP PostgreSQL pool. Disabled by default so the plugin starts without PostgreSQL. All JDBC work must be async — never on the main thread. Use player UUIDs for identity.

## Reports persistence (FASE 5)

EscapezCore owns the Minecraft reports table. Selection (`reports.persistence`):

| Mode | Behavior |
|------|----------|
| `auto` (default) | Use PostgreSQL when `database.enabled` + pool healthy; else local SQLite `reports.db`; else YAML `reports.yml` |
| `postgres` | Prefer Hikari PG; fall back if unavailable |
| `sqlite` | Local SQLite file in plugin data folder |
| `file` | YAML file fallback |

Schema table: `escapez_reports` (id, reporter/target UUID + display name, reason, status, staff_notes, claimed_by, timestamps). Migratable via `CREATE TABLE IF NOT EXISTS` + indexes.

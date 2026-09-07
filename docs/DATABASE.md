# Database (FASE 6)

EscapezCore uses an optional **HikariCP** pool with **Flyway** migrations. PostgreSQL is preferred for production; SQLite is OK for development (`database.type: sqlite`). The plugin always starts if the database is down.

## Secrets (never log)

| Variable | Purpose |
|----------|---------|
| `ESCAPEZ_DB_PASSWORD` | DB password (preferred over `config.yml`) |
| `ESCAPEZ_DB_USER` | Optional username override |
| `ESCAPEZ_DB_URL` | Optional JDBC URL override |

Leave `database.password` empty in `config.yml` and inject the env var at runtime.

## Async / main-thread safety

- `DatabaseModule.enable()` **never** blocks on pool connect or Flyway — init runs asynchronously.
- Ready flag + `whenReady` / `readyFuture()` for dependents (e.g. ReportModule).
- **Never** call `.join()` / `.get()` on DB futures from the Paper main thread (FASE 5 hang lesson).
- All JDBC via `DatabaseModule.supplyAsync` or repository async APIs.

## Flyway ownership (EscapezCore only)

History table: **`escapez_schema_history`** (avoids colliding with Staff Panel Flyway).

Locations (bundled in the plugin jar):

| Dialect | Classpath |
|---------|-----------|
| PostgreSQL | `db/migration/postgresql` |
| SQLite | `db/migration/sqlite` (applied via `SqliteSchemaBootstrap` — Flyway PG module; SQLite uses same scripts + `escapez_schema_history`) |

### Tables owned by EscapezCore

| Table | Purpose |
|-------|---------|
| `minecraft_players` | UUID PK, name, first/last seen, last IP |
| `escapez_reports` | Player reports (FASE 5+) |
| `player_preferences` | Per-player prefs (UUID + key) |
| `command_cooldowns` | Optional persistent cooldowns |
| `staff_chat_logs` | Staffchat audit trail |
| `mc_audit_log` | MC-side audit skeleton |

**Do not** create Staff Panel tables here (web users/auth/roles/tickets/appeals/planner).

## Reports persistence

Selection (`reports.persistence`):

| Mode | Behavior |
|------|----------|
| `auto` (default) | Wait for DatabaseModule ready (Flyway); else local SQLite `reports.db`; else YAML `reports.yml` |
| `postgres` | Prefer central DB; fall back if unavailable |
| `sqlite` | Local SQLite file in plugin data folder |
| `file` | YAML file fallback |

When using DatabaseModule, report DDL is Flyway-managed (`schemaManagedExternally=true`). Local `reports.db` still uses lightweight `CREATE TABLE IF NOT EXISTS` for the reports table only.

## Pool config

See `database.pool.*` in `config.yml` (name, maximum-pool-size, minimum-idle, timeouts, optional leak-detection-threshold-ms).

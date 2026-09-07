# Database notes

EscapezCore (Paper plugin) owns Minecraft-side schema via **Flyway** migrations shipped in the plugin jar:

- `minecraft/escapezcore/src/main/resources/db/migration/postgresql/`
- `minecraft/escapezcore/src/main/resources/db/migration/sqlite/`

History table: `escapez_schema_history`.

Staff Panel schema (web users, auth, roles, tickets, appeals, planner) is **out of scope** for EscapezCore — own it in the panel backend only.

Never commit real credentials. See `deployment/.env.example` (`ESCAPEZ_DB_PASSWORD`, etc.).

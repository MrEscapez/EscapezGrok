# Database

EscapezCore ships with an **optional** HikariCP PostgreSQL skeleton (`database.enabled: false` by default).

- No main-thread SQL
- Identity by UUID only
- Full reports schema / Staff Panel DB is out of scope for this drop

Never commit real credentials. See `deployment/.env.example`.

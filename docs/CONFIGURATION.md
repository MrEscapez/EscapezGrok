# Configuration

Files live in `plugins/EscapezCore/` after first start. EscapezCore merges defaults using **`config-version`** (current: **8**). Soft-reload with `/ec admin reload` — never Bukkit `/reload`.

## File list

| File | Purpose |
|------|---------|
| `config.yml` | Prefix, database (Hikari/Flyway), cooldowns, reports, staffchat, debug, **api** bridge |
| `messages.yml` | Dutch MiniMessage strings; brace placeholders `{key}` before MiniMessage parse |
| `commands.yml` | Info / report-related command definitions (URLs are examples only) |
| `aliases.yml` | Soft alias map synced to the command map on enable + soft-reload |
| `gui.yml` | Inventory layouts / GUI items |
| `scoreboard.yml` | Sidebar, tips, vote-reminder (FASE 7) |
| `resourcepack.yml` | Pack enable/required/url/SHA1/prompt/kick (FASE 8) |
| `items.yml` | Custom items; PDC identity `escapezcraft:item_id` (FASE 8) |
| `integrations.yml` | Soft-dep enable/disable per integration (FASE 9) |

## `config.yml` — key options

### General

| Key | Notes |
|-----|-------|
| `config-version` | Upgrade merge marker (**8**) |
| `prefix` | MiniMessage prefix for messages |
| `debug` | Extra logging (never logs secrets) |
| `cooldowns.default-seconds` / `info-commands-seconds` | Default command cooldown policy |
| `gui.open-on-ec` | Open main GUI on bare `/ec` |

### Database (`database.*`)

| Key | Notes |
|-----|-------|
| `enabled` | Optional; plugin always starts if DB is down |
| `type` | `postgresql` (prod) or `sqlite` (dev) |
| `jdbc-url` / `username` / `password` | Prefer env overrides for secrets |
| `sqlite-file` | Used when `type: sqlite` |
| `pool.*` | Hikari size/timeouts/optional leak detection |

Env (preferred): `ESCAPEZ_DB_PASSWORD`, optional `ESCAPEZ_DB_URL`, `ESCAPEZ_DB_USER`. Leave `database.password` empty in the file.

### Reports / staffchat

| Key | Notes |
|-----|-------|
| `reports.enabled` | Master switch |
| `reports.persistence` | `auto` \| `postgres` \| `sqlite` \| `file` |
| `reports.cooldown-seconds` | Per-player report cooldown |
| `staffchat.enabled` | Master switch |
| `staffchat.log-to-console` / `log-to-database` | Audit sinks |

### API bridge (`api.*`) — FASE 10

| Key | Notes |
|-----|-------|
| `enabled` | Outbound heartbeat/events + optional inbound listener |
| `base-url` | Staff Panel Nest base, e.g. `http://127.0.0.1:3000/api/v1` |
| `server-id` | Identity in heartbeats |
| `heartbeat-interval-seconds` | Min clamped in code |
| `listen.enabled` / `bind` / `port` | Inbound JDK `HttpServer` (default `127.0.0.1:8765`) |
| `auth.api-key` | Prefer `ESCAPEZ_API_KEY` env (align with panel `BRIDGE_API_KEY`) |
| `auth.hmac-enabled` / `hmac-secret` | Optional; prefer `ESCAPEZ_HMAC_SECRET` |

See [API.md](API.md) and [SECURITY.md](SECURITY.md).

## Other YAML highlights

- **`commands.yml`**: per-command `enabled`, `aliases`, `permission`, `cooldown-seconds`, `cooldown-bypass`, `console-allowed`, `player-only`, `hidden`, `logging`, `message-key`, `url`, `description`, `click-action`.
- **`scoreboard.yml`**: `scoreboard.enabled`, tips/vote-reminder blocks, refresh ticks, world filter.
- **`resourcepack.yml`**: placeholder `example.com` URLs are **not** sent to players.
- **`integrations.yml`**: toggle LuckPerms/Vault/PAPI/ItemsAdder/Nexo/detect-only plugins without crashing when absent.

## Monorepo pack build

See `resourcepack/README.md` (zip → SHA-1 → external HTTPS host). Wire the URL + hash into `resourcepack.yml`.

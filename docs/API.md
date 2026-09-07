# API

## Staff Panel bridge (FASE 10)

EscapezCore uses a **hybrid** bridge (chosen for Paper plugins):

1. **Outbound** HTTP client → Staff Backend Nest stubs (`POST /api/v1/bridge/heartbeat`, `POST /api/v1/bridge/events`) with `X-Escapez-Api-Key` (+ optional HMAC headers).
2. **Inbound** JDK `HttpServer` on a configurable bind/port so Staff Backend / Settings can call Core for module toggles without browser RCON/secrets.

When the panel is offline, the plugin keeps running; outbound events go to an in-memory pending queue and flush after a successful heartbeat.

### Auth

| Header | Purpose |
|--------|---------|
| `X-Escapez-Api-Key` | Shared secret (`ESCAPEZ_API_KEY` preferred; same family as Staff Panel `BRIDGE_API_KEY`) |
| `X-Escapez-Timestamp` | Unix ms (required when `api.auth.hmac-enabled`) |
| `X-Escapez-Signature` | `hex(HMAC-SHA256(timestamp + "." + rawBody, secret))` |

Secrets are never logged.

### Inbound endpoints (Core listener)

Base: `http://{bind}:{port}/api/v1` (default `127.0.0.1:8765`)

| Method | Path | Body | Notes |
|--------|------|------|-------|
| GET | `/modules` | — | List modules: `id`, `name`, `enabled`, `active`, `reloadable` |
| GET | `/modules/:id` | — | Single module |
| PATCH | `/modules/:id` | `{ "enabled": true\|false }` | Persist + **soft-reload** (never Bukkit `/reload`) |
| GET | `/health` | — | playersOnline, tps, version, panelOnline, pendingEvents |
| GET | `/status` | — | health + modules |

Module ids (contract): `scoreboard`, `tips`, `vote`, `resourcepack`, `reports`, `staffchat`, `items`.

Soft-reload runs on the Paper main thread via scheduler; HTTP workers may await — **never** `.join()`/`.get()` on the main thread.

### Outbound (Core → Nest)

| Method | Path | Auth |
|--------|------|------|
| POST | `/api/v1/bridge/heartbeat` | API key |
| POST | `/api/v1/bridge/events` | API key |

Heartbeat body (loose JSON): `serverId`, `status`, `playersOnline`, `tps`, `version`, `modules[]`.

Thin events: e.g. `report.created`.

### Config

See `config.yml` → `api:` (`config-version` **8**). Enable with `api.enabled: true` and set `ESCAPEZ_API_KEY`.

Admin (stealth): `/ec admin api`.

## Soft-dep adapters (FASE 9)

`HookManager` exposes:

- `getAdapter(Class<T extends PluginAdapter>)` / `getAdapter(String id)`
- `isAvailable(Class)` / `isAvailable(String id)` / `isPresent(String pluginName)`
- Typed helpers: `luckPerms()`, `vault()`, `placeholderApi()`, `itemsAdder()`, `nexo()`

Adapters never crash when the target plugin is missing; use `isAvailable()` before thin wrappers.

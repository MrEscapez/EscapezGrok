# Changelog

## 0.1.7
- FASE 10: Secure API bridge to Staff Panel — hybrid outbound heartbeat/events + inbound JDK HttpServer.
- Auth: `X-Escapez-Api-Key` (`ESCAPEZ_API_KEY`) + optional HMAC (`ESCAPEZ_HMAC_SECRET`); secrets never logged.
- Inbound: `GET /api/v1/modules`, `PATCH /api/v1/modules/:id` `{enabled}` with soft-reload (no main-thread join/get); also `/health` + `/status`.
- Module ids: scoreboard, tips, vote, resourcepack, reports, staffchat, items.
- Outbound aligns with Staff Panel stubs: `POST /api/v1/bridge/heartbeat` + `/events`; pending queue when panel offline.
- `/ec admin api` status (stealth); thin `report.created` event.
- Version **0.1.7**, config-version **8**.


## 0.1.6
- FASE 9: Plugin hooks / soft-dep adapters — `HookManager` + `integrations.yml` (enable/disable per integration).
- Adapters: LuckPerms / Vault / PlaceholderAPI (compileOnly public APIs); ItemsAdder / Nexo (reflection); LiteBans, WorldGuard, CoreProtect, Lands, McMMO, ExcellentCrates, MythicMobs, ModelEngine, CMI, ProtocolLib, ViaVersion, WorldEdit (detect-only).
- `getAdapter(Class)` / `isAvailable` patterns; soft-reload rescans integrations; `/ec admin hooks` status (stealth).
- IconResolver + PlaceholderResolver use adapters; absent plugins degrade gracefully (Dutch logs).
- Version **0.1.6**, config-version **7**.

## 0.1.5
- FASE 8: Resource pack module (`resourcepack.yml`) — enable/required/url/SHA1, join apply, Paper `PlayerResourcePackStatusEvent`, Dutch prompt/decline/fail/success (+ kick when required).
- Soft-reload safe via `/ec admin reload`; placeholder `example.com` URLs are not sent.
- Custom items module (`items.yml`) — identity via PDC `escapezcraft:item_id` (not display name).
- Admin: `/ec admin item list|info|give|get|gui` (+ perms `escapezcore.admin.item*`); admin items GUI reuses IconResolver MATERIAL|NEXO|ITEMSADDER + fallback.
- Monorepo `resourcepack/` stubs (namespace `escapezcraft`, font stubs) + zip/SHA1/external-host pipeline docs; neon branding note.
- Version **0.1.5**, config-version **6**.

## 0.1.4
- FASE 7: Scoreboard (no-flicker team-prefix sidebar), tips broadcast, vote reminders.
- `scoreboard.yml` — title/lines, refresh ticks, per-world filter, toggle, tips mode/interval, vote-reminder interval.
- PlaceholderAPI soft-dep via HookManager reflection; missing PAPI leaves or strips `%...%` gracefully.
- Player toggle `/sb` + `/ec scoreboard`; preference via PDC + optional `player_preferences` (async, no main-thread join).
- Vote reminder uses `commands.yml` vote.url example only; `/vote` unchanged.
- Soft-reload refreshes scoreboard/tips/vote without Bukkit `/reload`. Version **0.1.4**, config-version **5**.

## 0.1.3
- FASE 6: Database layer — HikariCP pool hardening (size, timeouts, optional leak detection, pool name).
- Flyway migrations for EscapezCore-owned tables only (`escapez_schema_history`); PostgreSQL + SQLite locations.
- Tables: `minecraft_players`, `escapez_reports`, `player_preferences`, `command_cooldowns`, `staff_chat_logs`, `mc_audit_log`.
- Async-only DB init/migrations — `enable()` never blocks; ready flags; ReportModule waits via `whenReady` (no main-thread join/get).
- Secrets via `ESCAPEZ_DB_PASSWORD` (+ optional `ESCAPEZ_DB_URL` / `ESCAPEZ_DB_USER`); never logged.
- UUID player identity upsert on join/quit; optional staffchat DB logging.
- Graceful degrade when DB down (SQLite/file reports fallback). config-version 4.

## 0.1.2
- FASE 5: player reports (`/report`, `/ec report`) with cooldown, statuses OPEN/IN_PROGRESS/RESOLVED/DISMISSED, staff notes, staff notify.
- Report persistence: PostgreSQL when DatabaseModule/Hikari enabled; else SQLite (`reports.db`); else YAML file fallback (`reports.yml`). Async I/O, UUID identity.
- Staff report management: `/reports` and `/ec admin report` (list/view/claim/resolve/dismiss/note); stealth admin rules preserved.
- Staffchat: `/sc` one-shot + toggle mode, never leaks to global chat, console logging, Dutch config messages.

## 0.1.1
- FASE 4 GUI framework: configurable items (icon MATERIAL|NEXO|ITEMSADDER + fallback), amounts, glow, custom-model-data, permissions, actions (command/open/message/close/admin/console).
- Anti-exploit inventory protection for Escapez GUIs (shift/number/drag/collect/creative/double-click; top-inventory + holder/menuId validation).
- Custom item identity via PDC `escapezcraft:item_id`.
- In-game GUI editor skeleton: `/ec admin gui [list|open|reload|save|edit]`.
- Soft-reload refreshes gui.yml without Bukkit `/reload`.

## 0.1.0
- Initial FASE 2 EscapezCore: ModuleManager, config/messages, hooks detect-only, optional HikariCP, commands + GUI, Dutch MiniMessage defaults.
- FASE 3: configurable commands + brace placeholder QA fixes.

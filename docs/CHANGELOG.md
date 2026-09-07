# Changelog

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

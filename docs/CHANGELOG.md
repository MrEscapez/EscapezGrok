# Changelog

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

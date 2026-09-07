# Configuration

Main files in `plugins/EscapezCore/`:
- `config.yml` — prefix, database (Hikari/Flyway), cooldowns, reports, staffchat, debug (`config-version` merge; current **8**)
- `messages.yml` — Dutch MiniMessage strings; brace placeholders `{key}` are substituted before MiniMessage parse
- `commands.yml` — info command definitions (example URLs only): enabled, aliases, permission, cooldown, bypass, console/player rules, hidden, logging, message-key, url, description, click-action
- `aliases.yml` — soft alias map (synced to command map on enable/reload)
- `gui.yml` — inventory layouts
- `scoreboard.yml` — sidebar, tips, vote-reminder (FASE 7)
- `resourcepack.yml` — pack enable/required/url/SHA1/prompt/kick (FASE 8; example.com placeholders are not sent)
- `items.yml` — custom item definitions; PDC identity `escapezcraft:item_id` (FASE 8)
- `integrations.yml` — soft-dep enable/disable per integration (FASE 9)
- `config.yml` → `api:` — Staff Panel bridge (FASE 10): outbound base-url, heartbeat, inbound listen bind/port, auth

API secrets: prefer `ESCAPEZ_API_KEY` (+ optional `ESCAPEZ_HMAC_SECRET`).

Database secrets: prefer `ESCAPEZ_DB_PASSWORD` (and optional `ESCAPEZ_DB_URL` / `ESCAPEZ_DB_USER`) over `config.yml`.

Monorepo pack build: see `resourcepack/README.md` (zip → SHA-1 → external HTTPS host).

Use `/ec admin reload` (requires `escapezcore.admin`) — **never** `/reload` / Bukkit reload.

# Configuration

Main files in `plugins/EscapezCore/`:
- `config.yml` — prefix, database toggle, cooldowns, debug (`config-version` merge)
- `messages.yml` — Dutch MiniMessage strings; brace placeholders `{key}` are substituted before MiniMessage parse
- `commands.yml` — info command definitions (example URLs only): enabled, aliases, permission, cooldown, bypass, console/player rules, hidden, logging, message-key, url, description, click-action
- `aliases.yml` — soft alias map (synced to command map on enable/reload)
- `gui.yml` — inventory layouts

Use `/ec admin reload` (requires `escapezcore.admin`) — **never** `/reload` / Bukkit reload.

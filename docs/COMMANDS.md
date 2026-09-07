# Commands

| Command | Description |
|---------|-------------|
| `/ec` | Opens main GUI |
| `/ec help` | Permission-filtered, clickable help (no admin leak) |
| `/ec admin` | Admin tools (fully hidden without `escapezcore.admin`) |
| `/ec admin reload` | Soft-reload configs (never Bukkit `/reload`) |
| `/discord` `/website` `/vote` `/shop` `/regels` `/staff` | Info links from `commands.yml` (example URLs only) |

Aliases (`dc`, `web`, `site`, `stem`, `store`, `rules`, `team`) come from `plugin.yml` / `aliases.yml` / `commands.yml` and are synced on enable + soft-reload.

Per-command options in `commands.yml`: `enabled`, `aliases`, `permission`, `cooldown-seconds`, `cooldown-bypass`, `console-allowed`, `player-only`, `hidden`, `logging`, `message-key`, `url`, `description`, `click-action`.

# Commands

| Command | Description |
|---------|-------------|
| `/ec` | Opens main GUI |
| `/ec help` | Permission-filtered, clickable help (no admin leak) |
| `/ec admin` | Admin tools (fully hidden without `escapezcore.admin`) |
| `/ec admin reload` | Soft-reload configs (never Bukkit `/reload`) |
| `/ec admin gui` | Open admin GUI / editor skeleton home |
| `/ec admin gui list` | List menus from gui.yml |
| `/ec admin gui open <id>` | Open menu for inspect |
| `/ec admin gui reload` | Reload gui.yml menus only |
| `/ec admin gui save` | Stub save hook (full editor later) |
| `/ec admin gui edit` | Editor home (list + hints) |
| `/discord` `/website` `/vote` `/shop` `/regels` `/staff` | Info links from `commands.yml` (example URLs only) |

Aliases (`dc`, `web`, `site`, `stem`, `store`, `rules`, `team`) come from `plugin.yml` / `aliases.yml` / `commands.yml` and are synced on enable + soft-reload.

Per-command options in `commands.yml`: `enabled`, `aliases`, `permission`, `cooldown-seconds`, `cooldown-bypass`, `console-allowed`, `player-only`, `hidden`, `logging`, `message-key`, `url`, `description`, `click-action`.

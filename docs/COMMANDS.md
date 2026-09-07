# Commands

| Command | Description |
|---------|-------------|
| `/ec` | Opens main GUI |
| `/ec help` | Permission-filtered, clickable help (no admin leak) |
| `/ec report <speler> <reden>` | Report a player (same as `/report`) |
| `/ec admin` | Admin tools (fully hidden without `escapezcore.admin`) |
| `/ec admin reload` | Soft-reload configs (never Bukkit `/reload`) |
| `/ec admin gui` | Open admin GUI / editor skeleton home |
| `/ec admin gui list` | List menus from gui.yml |
| `/ec admin gui open <id>` | Open menu for inspect |
| `/ec admin gui reload` | Reload gui.yml menus only |
| `/ec admin gui save` | Stub save hook (full editor later) |
| `/ec admin gui edit` | Editor home (list + hints) |
| `/ec admin item list` | List custom items from items.yml |
| `/ec admin item info [id]` | Hand PDC info or definition for id |
| `/ec admin item give <id> [speler] [aantal]` | Give custom item |
| `/ec admin item get <id> [aantal]` | Give custom item to self |
| `/ec admin item gui` | Open admin items GUI |
| `/ec admin report …` | Staff report management (stealth admin) |
| `/report <speler> <reden>` | Report a player (`meld` alias) |
| `/reports <list\|view\|claim\|resolve\|dismiss\|note>` | Staff report management |
| `/sc [bericht]` | Staffchat toggle (no args) or one-shot message |
| `/discord` `/website` `/vote` `/shop` `/regels` `/staff` | Info links from `commands.yml` (example URLs only) |
| `/sb` `/ec scoreboard` | Toggle EscapezCore sidebar (pref: PDC + optional DB) |

Aliases (`dc`, `web`, `site`, `stem`, `store`, `rules`, `team`, `meld`, `staffchat`) come from `plugin.yml` / `aliases.yml` / `commands.yml` and are synced on enable + soft-reload.

Per-command options in `commands.yml`: `enabled`, `aliases`, `permission`, `cooldown-seconds`, `cooldown-bypass`, `console-allowed`, `player-only`, `hidden`, `logging`, `message-key`, `url`, `description`, `click-action`.

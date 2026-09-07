# Troubleshooting

## Wrong or duplicate jar

**Symptom:** Old features, missing `/ec admin api`, version mismatch in `/version` or logs.

**Fix:** Ensure only **`EscapezCore-0.1.8.jar`** is in `plugins/`. Delete older `EscapezCore-*.jar` files, then restart Paper (not Bukkit `/reload`).

## Plugin won't start

- Confirm **Java 21** and **Paper 1.21.x** (target **1.21.10**).
- Check `logs/latest.log` for EscapezCore enable errors.
- Soft-deps missing (LuckPerms, PAPI, …) must **not** prevent startup; if they do, file a bug — adapters should degrade.

## Startup hang / main-thread join lesson

**Symptom:** Server freezes on enable, reload, report init, or API module toggle.

**Cause:** Blocking `.join()` / `.get()` on the **Paper main thread** waiting for async DB or scheduled soft-reload work (FASE 5/6/10 lesson).

**Fix:** EscapezCore is designed to avoid this. Do not add main-thread joins in forks. API `PATCH /modules/:id` awaits only on **HTTP worker** threads; module soft-reload is scheduled via Bukkit scheduler. DB init stays async with ready flags.

## PlaceholderAPI missing

**Symptom:** Scoreboard/tips still show `%player_name%` (or placeholders stripped).

**Fix:** Install PlaceholderAPI **or** leave it absent — Core continues with graceful degrade. Check `integrations.yml` and `/ec admin hooks`.

## Database down

**Symptom:** Warnings about pool/Flyway; reports still work via SQLite/file fallback.

**Fix:** Set `database.enabled: false` if unused, or fix JDBC URL/credentials via **`ESCAPEZ_DB_*`** env vars. Passwords are never logged — do not expect them in log output when debugging auth failures.

## API key mismatch

**Symptom:** Staff Panel ↔ Core bridge returns 401; module toggles fail; outbound heartbeat rejected.

**Fix:**

1. Set the **same** secret in Core `ESCAPEZ_API_KEY` and Staff Panel `BRIDGE_API_KEY`.
2. Leave `api.auth.api-key` empty in `config.yml` when using env.
3. Confirm `api.enabled: true` and inbound `listen.bind` reachable from the panel (usually `127.0.0.1:8765`).
4. If `hmac-enabled: true`, also align `ESCAPEZ_HMAC_SECRET` and send timestamp/signature headers.
5. Check `/ec admin api` (admin only) — summary must show `apiKey=(env)` or `(config)`, never print the key.

## Resource pack not applying

- `resourcepack.yml` → `enabled: true` with a real HTTPS URL + SHA-1.
- Placeholder `example.com` URLs are intentionally **not** sent.
- Required packs kick/decline messages are Dutch MiniMessage strings in config/messages.

## Missing GUI / empty menus

- Validate `gui.yml` materials, slots, and menu ids.
- Soft-reload: `/ec admin gui reload` or `/ec admin reload`.
- Confirm the player has permission for the menu/item actions.

## Cooldowns feel stuck

- Global bypass: `escapezcore.cooldown.bypass`.
- Per-command bypass node from `commands.yml` → `cooldown-bypass`.
- Soft-reload clears in-memory command definitions; cooldown map is in-memory (cleared on quit via service clear where wired).

## Still stuck?

Collect: Paper version, Java version, EscapezCore jar name, whether DB/API are enabled, and a log snippet **with secrets redacted**.

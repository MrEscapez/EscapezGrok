# Security

## Secrets and environment

Never commit real passwords, API keys, or HMAC secrets. Use placeholders (`CHANGE_ME`, empty strings) in examples.

| Secret | Preferred source | Fallback |
|--------|------------------|----------|
| Database password | `ESCAPEZ_DB_PASSWORD` | `database.password` in `config.yml` (keep empty in git) |
| DB URL / user overrides | `ESCAPEZ_DB_URL` / `ESCAPEZ_DB_USER` | `database.jdbc-url` / `username` |
| Bridge API key | `ESCAPEZ_API_KEY` | `api.auth.api-key` (keep empty in git) |
| Bridge HMAC secret | `ESCAPEZ_HMAC_SECRET` | `api.auth.hmac-secret` |

Align Core `ESCAPEZ_API_KEY` with Staff Panel `BRIDGE_API_KEY` (same shared secret family). Do not invent alternate auth schemes.

## No secret logging

- Database passwords and bridge keys/HMAC secrets are **never** written to logs.
- `ApiSettings.safeSummary()` reports only whether a key exists (`(env)` / `(config)` / `(leeg)`), never the value.
- Auth failures must not echo the presented key.

## API bind and exposure

- Default inbound listen: **`127.0.0.1:8765`**. Keep loopback (or a private network) in production.
- Require `X-Escapez-Api-Key` on all inbound routes when the API is enabled.
- Optional HMAC: `X-Escapez-Timestamp` + `X-Escapez-Signature` (`hex(HMAC-SHA256(timestamp + "." + rawBody, secret))`), max skew 5 minutes.
- Do not expose the inbound port on the public internet without a reverse proxy and network policy.

## Permission / stealth admin

- `/ec admin` is fully hidden without `escapezcore.admin` (no help line, no tab completion, unknown-subcommand response).
- Soft reload only (`/ec admin reload`) — **never** Bukkit `/reload`.
- Example URLs only in default `commands.yml` / docs.

## Runtime safety

- No NMS.
- No main-thread blocking on DB init/migrations (async ready flags; never `.join()` / `.get()` on the Paper main thread).
- No main-thread blocking await on API module soft-reload (HTTP workers may await; Paper main thread must not).

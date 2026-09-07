# Security / Beveiliging

## EscapezCore (Minecraft plugin)

### Secrets and environment

Never commit real passwords, API keys, or HMAC secrets. Use placeholders (`CHANGE_ME`, empty strings) in examples.

| Secret | Preferred source | Fallback |
|--------|------------------|----------|
| Database password | `ESCAPEZ_DB_PASSWORD` | `database.password` in `config.yml` (keep empty in git) |
| DB URL / user overrides | `ESCAPEZ_DB_URL` / `ESCAPEZ_DB_USER` | `database.jdbc-url` / `username` |
| Bridge API key | `ESCAPEZ_API_KEY` | `api.auth.api-key` (keep empty in git) |
| Bridge HMAC secret | `ESCAPEZ_HMAC_SECRET` | `api.auth.hmac-secret` |

Align Core `ESCAPEZ_API_KEY` with Staff Panel `BRIDGE_API_KEY` (same shared secret family). Do not invent alternate auth schemes.

### No secret logging

- Database passwords and bridge keys/HMAC secrets are **never** written to logs.
- `ApiSettings.safeSummary()` reports only whether a key exists (`(env)` / `(config)` / `(leeg)`), never the value.
- Auth failures must not echo the presented key.

### API bind and exposure

- Default inbound listen: **`127.0.0.1:8765`**. Keep loopback (or a private network) in production.
- Require `X-Escapez-Api-Key` on all inbound routes when the API is enabled.
- Optional HMAC: `X-Escapez-Timestamp` + `X-Escapez-Signature` (`hex(HMAC-SHA256(timestamp + "." + rawBody, secret))`), max skew 5 minutes.
- Do not expose the inbound port on the public internet without a reverse proxy and network policy.

### Permission / stealth admin

- `/ec admin` is fully hidden without `escapezcore.admin` (no help line, no tab completion, unknown-subcommand response).
- Soft reload only (`/ec admin reload`) — **never** Bukkit `/reload`.
- Example URLs only in default `commands.yml` / docs.

### Runtime safety

- No NMS.
- No main-thread blocking on DB init/migrations (async ready flags; never `.join()` / `.get()` on the Paper main thread).
- No main-thread blocking await on API module soft-reload (HTTP workers may await; Paper main thread must not).

## Staff Panel (NestJS + Vite) — FASE 16

### Cookies and CSRF (NL/EN)

- Sessions use an **HttpOnly** cookie (`SESSION_COOKIE_NAME`, default `escapez_staff_session`).
- Cookie attributes: `SameSite=Lax` (mitigates classic CSRF from other sites), `Path=/`.
- Set `SESSION_COOKIE_SECURE=true` (or `NODE_ENV=production`) so the cookie is **Secure** over HTTPS only.
- **Future CSRF token:** for stricter protection (especially if SameSite must be relaxed), add a double-submit or synchronizer CSRF token on state-changing requests. Current demo relies on SameSite=Lax + same-origin Vite proxy in dev.
- Frontend must never store JWT/session ids in `localStorage`.

### Rate limiting

- In-memory sliding-window stub (`RateLimitGuard`) on `POST /auth/login` (10/min per IP+username) and `POST /server/rcon` (30/min per IP).
- Replace with Redis/shared store for multi-instance production.

### Headers and secrets

- `helmet` enabled on Nest HTTP (CSP left disabled for the separate SPA origin).
- Log scrubber (`scrubSecrets` / `scrubObject`) — never print passwords, API keys, RCON passwords, cookies, or Bearer tokens.
- Bridge key, RCON, Pterodactyl keys: **backend `.env` only** — never `VITE_*` / frontend.

### Demo credentials

- Seed users `admin` / `CHANGE_ME` and optional `helper` / `CHANGE_ME` — **change before any shared or public deploy**.

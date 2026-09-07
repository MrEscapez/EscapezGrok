# Deployment / Deployment

EscapezCore is a Paper plugin jar. Staff Panel production compose lives under `deployment/staff-panel/` and `deployment/docker-compose.staff-panel.yml`.

## EscapezCore — runtime requirements

| Component | Version / note |
|-----------|----------------|
| Java | **21** |
| Server | **Paper 1.21.10** (api-version `1.21`; build against published 1.21.x Paper API) |
| Plugin jar | `EscapezCore-0.1.8.jar` |
| Optional DB | PostgreSQL (prod) or SQLite (dev) |
| Optional bridge | Staff Panel Nest reachable from the game host |

## EscapezCore — jar deploy (generic / bare metal)

1. Build: `cd minecraft/escapezcore && ./gradlew build`
2. Copy `build/libs/EscapezCore-0.1.8.jar` → server `plugins/`
3. Remove older EscapezCore jars.
4. Set env vars in the process supervisor (systemd, Docker, panel startup) — see below.
5. Start Paper; confirm EscapezCore enables in logs (no secrets printed).
6. Configure `plugins/EscapezCore/*.yml` as needed; apply with `/ec admin reload`.

## EscapezCore — Pterodactyl / panel notes

- Upload the jar via the panel file manager into `/plugins` (or mount the volume and copy).
- Set startup image / Docker image to a **Java 21** Paper build for **1.21.10**.
- Put secrets in the egg/container **environment**, not in committed YAML:
  - `ESCAPEZ_DB_PASSWORD`, optional `ESCAPEZ_DB_URL`, `ESCAPEZ_DB_USER`
  - `ESCAPEZ_API_KEY` (and optional `ESCAPEZ_HMAC_SECRET`) when using the Staff Panel bridge
- Bind the inbound API to `127.0.0.1` unless the Staff Panel process shares a private network; open port **8765** only inside that network.
- Prefer a graceful restart over forcing Bukkit `/reload` after jar swaps.

## EscapezCore — environment variables

See `deployment/.env.example` for placeholders. Core-relevant keys:

```bash
ESCAPEZ_DB_URL=jdbc:postgresql://127.0.0.1:5432/escapezcraft
ESCAPEZ_DB_USER=escapez
ESCAPEZ_DB_PASSWORD=CHANGE_ME

ESCAPEZ_API_KEY=CHANGE_ME
ESCAPEZ_HMAC_SECRET=CHANGE_ME
```

Staff Panel should use the matching `BRIDGE_API_KEY=CHANGE_ME` (same value as `ESCAPEZ_API_KEY`).

## EscapezCore — health checks

- In-game: `/ec admin hooks`, `/ec admin api` (stealth; requires `escapezcore.admin`).
- Inbound (when enabled): `GET http://127.0.0.1:8765/api/v1/health` with `X-Escapez-Api-Key`.
- Database down → Core still runs; reports fall back per `reports.persistence`.

## Staff Panel FASE 16

### Stack

Compose file: `deployment/docker-compose.staff-panel.yml` (postgres, backend, frontend).  
Env template: `deployment/staff-panel/.env.example` (copy to `.env`; replace `CHANGE_ME`).  
Bring-up from repo root with that env-file and compose file (`up -d --build`).  
Frontend host **8080**; `/api` to Nest; Postgres host **5433**.

### First admin

`STAFF_BOOTSTRAP_USERNAME` / `STAFF_BOOTSTRAP_PASSWORD` (demo `admin` / `CHANGE_ME`).  
Change before shared hosts. Optional `STAFF_SEED_HELPER` + `STAFF_HELPER_*`.  
Rotate `SESSION_SECRET` and `BRIDGE_API_KEY` for production.

### Env vars

`SESSION_SECRET`, `SESSION_COOKIE_SECURE`, `STAFF_BOOTSTRAP_*`, `BRIDGE_API_KEY`,  
`CORE_API_BASE` (code default port 8765; off = local modules only),  
`RCON_*`, `PTERO_*`, `POSTGRES_*` — see `staff-panel/backend/.env.example`.  
Frontend only `VITE_API_URL` — no secrets in the client.

### HTTPS checklist

TLS at edge. `SESSION_COOKIE_SECURE=true`. Forward `X-Forwarded-Proto`.  
Same-site SPA and `/api`. See `docs/SECURITY.md`.

### Verify

Backend and frontend: install deps, run the test script, then build.

No secrets in git. Wijzig demo `CHANGE_ME` voor productie. / Change demo `CHANGE_ME` before production.

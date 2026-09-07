# Deployment

EscapezCore is a Paper plugin jar. Staff Panel, RCON automation, and full panel compose are documented separately under `staff-panel/` and `deployment/`.

## Runtime requirements

| Component | Version / note |
|-----------|----------------|
| Java | **21** |
| Server | **Paper 1.21.10** (api-version `1.21`; build against published 1.21.x Paper API) |
| Plugin jar | `EscapezCore-0.1.8.jar` |
| Optional DB | PostgreSQL (prod) or SQLite (dev) |
| Optional bridge | Staff Panel Nest reachable from the game host |

## Jar deploy (generic / bare metal)

1. Build: `cd minecraft/escapezcore && ./gradlew build`
2. Copy `build/libs/EscapezCore-0.1.8.jar` → server `plugins/`
3. Remove older EscapezCore jars.
4. Set env vars in the process supervisor (systemd, Docker, panel startup) — see below.
5. Start Paper; confirm EscapezCore enables in logs (no secrets printed).
6. Configure `plugins/EscapezCore/*.yml` as needed; apply with `/ec admin reload`.

## Pterodactyl / panel notes

- Upload the jar via the panel file manager into `/plugins` (or mount the volume and copy).
- Set startup image / Docker image to a **Java 21** Paper build for **1.21.10**.
- Put secrets in the egg/container **environment**, not in committed YAML:
  - `ESCAPEZ_DB_PASSWORD`, optional `ESCAPEZ_DB_URL`, `ESCAPEZ_DB_USER`
  - `ESCAPEZ_API_KEY` (and optional `ESCAPEZ_HMAC_SECRET`) when using the Staff Panel bridge
- Bind the inbound API to `127.0.0.1` unless the Staff Panel process shares a private network; open port **8765** only inside that network.
- Prefer a graceful restart over forcing Bukkit `/reload` after jar swaps.

## Environment variables

See `deployment/.env.example` for placeholders. Core-relevant keys:

```bash
ESCAPEZ_DB_URL=jdbc:postgresql://127.0.0.1:5432/escapezcraft
ESCAPEZ_DB_USER=escapez
ESCAPEZ_DB_PASSWORD=CHANGE_ME

ESCAPEZ_API_KEY=CHANGE_ME
ESCAPEZ_HMAC_SECRET=CHANGE_ME
```

Staff Panel should use the matching `BRIDGE_API_KEY=CHANGE_ME` (same value as `ESCAPEZ_API_KEY`).

## Health checks

- In-game: `/ec admin hooks`, `/ec admin api` (stealth; requires `escapezcore.admin`).
- Inbound (when enabled): `GET http://127.0.0.1:8765/api/v1/health` with `X-Escapez-Api-Key`.
- Database down → Core still runs; reports fall back per `reports.persistence`.

## Out of scope here

Staff Panel frontend/backend deploy, RCON credentials, and Pterodactyl client API tokens belong to the Staff Panel deployment docs — never embed those secrets in EscapezCore configs.

# EscapezCraft Staff Panel — Backend

NestJS + TypeScript API (FASE 11–14 stubs + settings modules).

## Setup

1. Copy .env.example to .env and replace CHANGE_ME values
2. npm install then npm run start:dev
3. API: http://localhost:3000/api/v1

## Bootstrap login (local demo)

- `STAFF_BOOTSTRAP_USERNAME=admin`
- `STAFF_BOOTSTRAP_PASSWORD=CHANGE_ME` (plaintext in env only; bcrypt-hashed in memory at boot)
- Sessions: HttpOnly cookie (`SESSION_COOKIE_NAME`), not JWT in localStorage

## EscapezCore bridge (FASE 13)

EscapezCore will POST heartbeat/events to /api/v1/bridge/ with header X-Escapez-Api-Key
matching BRIDGE_API_KEY from env (CHANGE_ME_BRIDGE_KEY in .env.example). Never expose to frontend.
HMAC-ready stub: src/bridge/bridge-auth.ts (API key only today).

- POST /api/v1/bridge/heartbeat
- POST /api/v1/bridge/events
- GET /api/v1/bridge/status (staff session OR bridge key)
- GET /api/v1/bridge/modules (bridge key) — module on/off status for EscapezCore


## Settings modules (EscapezCore soft-reload contract)

Staff cookie + RBAC (`settings:view` / `settings:manage`). Stable ids only:
`scoreboard`, `tips`, `vote`, `resourcepack`, `reports`, `staffchat`, `items`.

Persisted to `data/modules.json` (in-memory + JSON file).

- GET /api/v1/settings/modules → `{ modules: [{ id, label, enabled, source }] }`
  - `source`: `local` | `core` | `pending`
- PATCH /api/v1/settings/modules/:id `{ enabled: boolean }` → module + `syncStatus` +
  `{ softReload: true, note: "soft-reload gevraagd (stub tot EscapezCore FASE 10 live is)" }`

Panel → Core push stub: when `CORE_API_BASE` is set, backend PATCHes
`{CORE}/api/v1/modules/:id` with `X-Escapez-Api-Key`. On 503/timeout/error (or when Core
is not configured): local save + `syncStatus=pending`. Matches future EscapezCore
soft-reload PATCH (no main-thread join).

## Realtime SSE

GET /api/v1/realtime/stream — staff cookie required. Open dashboard while logged in;
EventSource uses Vite proxy /api/v1/realtime/stream.

## Planner (FASE 14 stubs)

In-memory week schedules (Map). Staff cookie required on all planner routes.

Default shift windows: EARLY 06–14, DAY 14–22, LATE 22–06, NIGHT 22–06, OFF none.

- GET /api/v1/planner/schedules?weekStart=YYYY-MM-DD
- GET /api/v1/planner/schedules/:id
- POST /api/v1/planner/schedules — create DRAFT (or return existing for week)
- PUT /api/v1/planner/schedules/:id/shifts — replace shifts + optimistic version (409 on mismatch)
- POST /api/v1/planner/schedules/:id/validate — validators (MinimumRest, EarlyShift, Weekend, Holiday, RequiredStaffing, Couple stub)
- POST /api/v1/planner/schedules/:id/publish — only if no ERROR
- POST /api/v1/planner/schedules/:id/draft — revert to DRAFT

Seeds one DRAFT week (current Monday) with demo shifts on boot.

## Endpoints

- GET /api/v1/health
- POST /api/v1/auth/login, POST /api/v1/auth/logout, GET /api/v1/auth/me
- GET /api/v1/players, GET /api/v1/reports
- GET /api/v1/punishments, GET /api/v1/tickets
- GET/PATCH /api/v1/settings/modules…
- planner as above
- bridge + realtime as above

## Out of scope

Full planner engine / persistence, live RCON, LiteBans deep integration, real secrets, minecraft Java.

# EscapezCraft Staff Panel — Backend

NestJS + TypeScript API (FASE 11-13 stubs).

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

## Realtime SSE

GET /api/v1/realtime/stream — staff cookie required. Open dashboard while logged in;
EventSource uses Vite proxy /api/v1/realtime/stream.

## Endpoints

- GET /api/v1/health
- POST /api/v1/auth/login, POST /api/v1/auth/logout, GET /api/v1/auth/me
- GET /api/v1/players, GET /api/v1/reports
- GET /api/v1/punishments, GET /api/v1/tickets
- bridge + realtime as above

## Out of scope

Planner engine, live RCON, LiteBans deep integration, real secrets, minecraft Java.

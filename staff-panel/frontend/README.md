# EscapezCraft Staff Panel — Frontend

Vite + React + TypeScript. Dutch UI, dark neon (zwart / rood / blauw).

## Setup

1. Copy .env.example to .env (VITE_API_URL only — no secrets)
2. npm install then npm run dev
3. UI: http://localhost:5173

## Auth flow

- `GET /auth/me` – session check (TanStack Query)
- `POST /auth/login` / `POST /auth/logout` – credentials: `include`
- Unauthenticated → `/login`; authenticated → app layout + **Uitloggen**

## Vite proxy

Dev server proxies `/api` → http://127.0.0.1:3000 so cookies stay same-origin.
Set `VITE_API_URL=/api/v1` (default in `.env.example`).

Without proxy: `VITE_API_URL=http://localhost:3000/api/v1` and backend CORS with `credentials: true`.

## Live feed (SSE)

While logged in, the dashboard connects EventSource to `/api/v1/realtime/stream`
(via Vite `/api` proxy). Shows Dutch labels for heartbeats and bridge events;
reconnects on error. Graceful if SSE unsupported.

Preview paths: `/dashboard`, `/punishments`, `/tickets`, `/planner`, `/settings`.

## Planner (FASE 14 stubs)

Route `/planner` — week selector, DRAFT/PUBLISHED badge + version, days×staff grid with HTML5 drag-and-drop shift chips, Valideren / Publiceren / Terug naar draft. Dutch UI; TanStack Query. No RCON/secrets in the client.


## Settings modules

Route `/settings` — EscapezCore module aan/uit toggles (Dutch, dark neon).
TanStack Query list + optimistic PATCH with rollback. Shows local saved /
pending sync badges and soft-reload toast. No secrets/RCON in the client.

## Out of scope

Full planner engine / persistence, live RCON, LiteBans deep integration. No secrets/RCON in the client.

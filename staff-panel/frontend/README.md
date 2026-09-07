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

Preview paths: `/dashboard`, `/punishments`, `/tickets`, `/planner`, `/server`, `/settings`.

## Planner (FASE 14 stubs)

Route `/planner` — week selector, DRAFT/PUBLISHED badge + version, days×staff grid with HTML5 drag-and-drop shift chips, Valideren / Publiceren / Terug naar draft. Dutch UI; TanStack Query. No RCON/secrets in the client.


## Settings modules

Route `/settings` — EscapezCore module aan/uit toggles (Dutch, dark neon).
TanStack Query list + optimistic PATCH with rollback. Shows local saved /
pending sync badges and soft-reload toast. No secrets/RCON in the client.


## Server (FASE 15)

Route `/server` — power status cards, Start/Stop/Restart with Dutch confirm dialog,
safe RCON command input. Calls Nest `/api/v1/server/*` with cookies only.
Never stores or logs RCON/Pterodactyl secrets. Shows stub messaging when backend not configured.
Settings → Pterodactyl: panel URL + write-only API keys + connection test.
Server page lists all Application API servers when configured.


## Out of scope

Full planner engine / persistence, LiteBans deep integration. No secrets/RCON/Pterodactyl credentials in the client.

## RBAC (UI)

- Nav links are hidden without the matching `*:view` permission from `/auth/me`.
- Routes use `RequirePermission` → `/forbidden` (403 page) when missing.
- `can('server:power')` helper in `src/lib/permissions.ts` + `useCan()`.
- Users page: `/users` (Dutch) — list, assign roles, create user, role permission matrix.
- Backend still enforces all mutations; UI hide is not security.

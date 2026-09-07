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

## Out of scope

Planner engine, live RCNN, LiteBans deep integration. No secrets/RCON in the client.

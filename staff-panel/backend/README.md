# EscapezCraft Staff Panel — Backend

NestJS + TypeScript API (FASE 11-12 + login/session slice).

## Setup

1. Copy .env.example to .env and replace CHANGE_ME values
2. npm install then npm run start:dev
3. API: http://localhost:3000/api/v1

## Bootstrap login (local demo)

- `STAFF_BOOTSTRAP_USERNAME=admin`
- `STAFF_BOOTSTRAP_PASSWORD=CHANGE_ME` (plaintext in env only; bcrypt-hashed in memory at boot)
- Sessions: HttpOnly cookie (`SESSION_COOKIE_NAME`), not JWT in localStorage

## Endpoints

- `GET /api/v1/health`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`

## Out of scope

Planner engine, live RCON, LiteBans deep integration, real secrets.

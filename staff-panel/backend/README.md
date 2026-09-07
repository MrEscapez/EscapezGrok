# EscapezCraft Staff Panel — Backend

NestJS + TypeScript API skeleton for FASE 11-12.

## Setup

1. Copy .env.example to .env and replace CHANGE_ME values
2. Run package install then start:dev (see package.json scripts)
3. API listens on port 3000 with prefix /api/v1

## Endpoints

- GET /api/v1/health
- POST /api/v1/auth/login
- POST /api/v1/auth/logout
- GET /api/v1/auth/me

## Out of scope

Planner engine, live RCON, LiteBans deep integration, real secrets.

# Discord Ticket Bridge

Spiegel gratis Ticket Tool-ticketkanalen naar het EscapezCraft Staff Panel (zonder Ticket Tool Pro API).

Mirrors free Ticket Tool ticket channels into the EscapezCraft Staff Panel (no Ticket Tool Pro API).

## NL — Setup

1. Ga naar [Discord Developer Portal](https://discord.com/developers/applications) → **New Application** → tab **Bot** → **Add Bot**.
2. Kopieer de **Bot Token** → `DISCORD_BOT_TOKEN`.
3. Onder **Privileged Gateway Intents**: zet **Message Content Intent** aan (vereist om berichten te lezen).
4. Invite de bot met minstens: **View Channels**, **Read Message History**, **Read Messages** (Send Messages niet nodig).
   - OAuth2 URL Generator → scopes: `bot` → permissions hierboven → invite naar je guild.
5. In Discord: Developer Mode aan → rechtermuisklik op de **Ticket Tool ticket-categorie** → **Copy Channel ID**. Plak in `TICKET_CATEGORY_IDS` (meerdere: komma-gescheiden).
6. Genereer een sterk secret en zet het:
   - hier als `STAFF_PANEL_BRIDGE_SECRET`
   - én in Staff Panel → Instellingen → **Discord Bridge** (zelfde waarde).
7. Optioneel: `TICKET_CHANNEL_PREFIX` (default `ticket-`) en `STAFF_PANEL_URL` (default `https://staff.escapez.be`).

```bash
cp .env.example .env
# vul .env in
npm install
npm run build
npm start
```

Logs bij start tonen welke categorieën worden bewaakt.

## EN — Setup

1. Create a Discord application bot; enable **Message Content Intent**.
2. Invite with **View Channels** + **Read Message History** + **Read Messages**.
3. Paste Ticket Tool ticket **category IDs** into `TICKET_CATEGORY_IDS`.
4. Set `STAFF_PANEL_BRIDGE_SECRET` to the same secret configured in Staff Panel Settings → Discord Bridge.
5. `npm install && npm run build && npm start`.

## What it does

| Discord event | Staff Panel |
|---|---|
| `channelCreate` in watched category (+ optional name prefix) | `POST /api/v1/tickets/bridge/upsert` |
| `messageCreate` in tracked ticket | `POST /api/v1/tickets/bridge/message` |
| `channelDelete` or archive move/rename | `POST /api/v1/tickets/bridge/close` |

Auth: `Authorization: Bearer <secret>` and/or `X-Staff-Bridge-Secret`.

## Env

| Variable | Required | Default |
|---|---|---|
| `DISCORD_BOT_TOKEN` | yes | — |
| `STAFF_PANEL_BRIDGE_SECRET` | yes | — |
| `TICKET_CATEGORY_IDS` | yes | — |
| `STAFF_PANEL_URL` | no | `https://staff.escapez.be` |
| `TICKET_CHANNEL_PREFIX` | no | `ticket-` |

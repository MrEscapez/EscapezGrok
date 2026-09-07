# Security

- Never log database passwords or tokens (`ESCAPEZ_DB_PASSWORD` / config password)
- Never log bridge API keys / HMAC secrets (`ESCAPEZ_API_KEY`, `ESCAPEZ_HMAC_SECRET`)
- Bind API listen to localhost (or private network) in production; require API key on all inbound routes
- Prefer env for secrets; keep `database.password` empty in committed defaults
- Admin commands fully hidden without permission
- No NMS
- Example URLs only in default commands.yml
- Soft reload only — no Bukkit `/reload`
- No main-thread blocking on DB init/migrations
- No main-thread blocking on API soft-reload awaits (HTTP workers only)

# Security

- Never log database passwords or tokens (`ESCAPEZ_DB_PASSWORD` / config password)
- Prefer env for secrets; keep `database.password` empty in committed defaults
- Admin commands fully hidden without permission
- No NMS
- Example URLs only in default commands.yml
- Soft reload only — no Bukkit `/reload`
- No main-thread blocking on DB init/migrations

# EscapezCraft Resource Pack

Namespace: **`escapezcraft`** (`assets/escapezcraft/…`).

Branding: **black / red / blue neon** (plugin MiniMessage gradients use cyan→violet; pack art should lean black base with red `#FF1744` and blue `#00E5FF` accents). Do not invent binary art here — stubs + pipeline only.

## Layout

```
resourcepack/
  pack.mcmeta
  assets/escapezcraft/
    font/          # bitmap/ttf stubs (optional UI glyphs)
    models/item/   # custom model stubs (out of scope for full art)
    textures/item/
    textures/font/
```

## Build pipeline (zip + SHA-1 + external host)

Server-side apply is handled by EscapezCore (`resourcepack.yml` + join / `PlayerResourcePackStatusEvent`).
**Prefer hosting the zip on an external HTTPS CDN/static host** (not inside the plugin jar).

```bash
# From monorepo root
cd resourcepack
# Optional: exclude junk
zip -r ../escapezcraft-resourcepack.zip . -x '*.git*' -x '*.DS_Store'
sha1sum ../escapezcraft-resourcepack.zip
# → paste lowercase hex into plugins/EscapezCore/resourcepack.yml → sha1
# Upload the zip to your host; set url to the HTTPS link (never commit production secrets).
```

Then in `plugins/EscapezCore/resourcepack.yml`:

```yaml
enabled: true
required: false   # true = force/kick on decline/fail (see kick-on-*)
url: "https://YOUR-CDN.example/escapezcraft-resourcepack.zip"
sha1: "<40-char lowercase hex from sha1sum>"
```

Soft-reload: `/ec admin reload` (no Bukkit `/reload`).

Placeholder `https://example.com/...` URLs are **not** sent to clients (EscapezCore skips them) — replace with a real host before enabling.

## Out of scope (this FASE)

- Full custom model JSON / texture art pipeline
- Embedding the pack zip in EscapezCore

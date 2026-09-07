# Installation

EscapezCore targets **Paper 1.21.10** (api-version `1.21`) on **Java 21**.

## Build

```bash
cd minecraft/escapezcore
./gradlew build
```

Artifact: `minecraft/escapezcore/build/libs/EscapezCore-0.1.8.jar`

Optional checks:

```bash
./gradlew test
./gradlew build
```

## Install on the Paper server

1. Stop the Paper instance (or use your panel’s safe restart flow).
2. Copy **`EscapezCore-0.1.8.jar`** into the server `plugins/` folder.
3. Remove older `EscapezCore-*.jar` files so only one EscapezCore jar remains.
4. Start the server once so EscapezCore writes default configs under `plugins/EscapezCore/`.
5. Edit configs as needed (see [CONFIGURATION.md](CONFIGURATION.md)). Prefer env vars for secrets (see [SECURITY.md](SECURITY.md)).
6. Soft-reload after changes: `/ec admin reload` (requires `escapezcore.admin.reload`). **Never** use Bukkit `/reload`.

## First-boot defaults

| Setting | Recommended first boot |
|---------|------------------------|
| `database.enabled` | `false` until PostgreSQL/SQLite is ready |
| `api.enabled` | `false` until Staff Panel bridge key is set |
| `resourcepack.yml` → `enabled` | `false` until a real HTTPS pack URL + SHA-1 exist |
| Info command URLs in `commands.yml` | Replace `example.com` placeholders |

## Soft dependencies (optional)

Declared in `plugin.yml` (`softdepend`). Absent plugins degrade gracefully — EscapezCore still starts. Enable/disable per integration in `integrations.yml` (see [CONFIGURATION.md](CONFIGURATION.md)).

## Version notes

- Jar name embeds the plugin version (`0.1.8`).
- `config-version` in `config.yml` is currently **8** (merge marker for upgrades).
- Do not drop a mismatched Staff Panel key into Core configs; align `ESCAPEZ_API_KEY` with the panel `BRIDGE_API_KEY` family only when enabling the bridge.

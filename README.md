# EscapezCraft — EscapezGrok monorepo

Monorepo for EscapezCraft Paper core plugin, staff panel stubs, resource pack, database notes, and deployment examples.

## Layout

| Path | Description |
|------|-------------|
| `minecraft/escapezcore/` | EscapezCore Paper plugin (Gradle, Java 21) |
| `staff-panel/frontend/` | Staff Panel frontend stub |
| `staff-panel/backend/` | Staff Panel backend stub |
| `resourcepack/` | Custom resource pack stubs + zip/SHA1 host pipeline docs |
| `database/` | Database schema / ops notes |
| `deployment/` | Deploy env examples |
| `docs/` | Documentation |

## EscapezCore quick start

```bash
cd minecraft/escapezcore
./gradlew build
# JAR: build/libs/EscapezCore-0.1.8.jar
```

Requires **Java 21**. Database (PostgreSQL) is optional — leave `database.enabled: false` in `config.yml`.

Resource pack: configure `resourcepack.yml` after hosting a zip (see `resourcepack/README.md`). Custom items: `items.yml` + `/ec admin item …`.

## Author

birger147 — EscapezCraft

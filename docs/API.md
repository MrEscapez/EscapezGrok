# API

No public HTTP API in this drop. Internal module API lives under `be.escapezcraft.escapezcore`.

## Soft-dep adapters (FASE 9)

`HookManager` exposes:

- `getAdapter(Class<T extends PluginAdapter>)` / `getAdapter(String id)`
- `isAvailable(Class)` / `isAvailable(String id)` / `isPresent(String pluginName)`
- Typed helpers: `luckPerms()`, `vault()`, `placeholderApi()`, `itemsAdder()`, `nexo()`

Adapters never crash when the target plugin is missing; use `isAvailable()` before thin wrappers.

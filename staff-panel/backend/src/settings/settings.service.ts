import {
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import {
  MODULE_CATALOG,
  ModuleId,
  ModulePatchResult,
  ModuleSource,
  ModuleStatus,
  ModulesFileShape,
  SyncStatus,
  isModuleId,
} from './settings.types';
import { getBridgeApiKey } from '../bridge/bridge-auth';

type StoredModule = {
  id: ModuleId;
  enabled: boolean;
  source: ModuleSource;
};

type CorePushResult = {
  source: ModuleSource;
  syncStatus: SyncStatus;
  note: string;
};

/** Default EscapezCore inbound listener (docs/API.md). */
const DEFAULT_CORE_API_BASE = 'http://127.0.0.1:8765';

const NOTE_CORE_SOFT_RELOAD = 'Soft-reload uitgevoerd via EscapezCore.';
const NOTE_CORE_DISABLED =
  'Lokaal opgeslagen. Panel→Core proxy uitgeschakeld (CORE_API_BASE=off).';
const NOTE_CORE_OFFLINE =
  'Lokaal opgeslagen. EscapezCore onbereikbaar (timeout/offline) — sync pending.';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly byId = new Map<ModuleId, StoredModule>();
  private dataPath = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const configured = this.config.get<string>('MODULES_DATA_PATH');
    this.dataPath =
      configured && configured.trim()
        ? configured.trim()
        : join(process.cwd(), 'data', 'modules.json');
    this.loadOrSeed();
  }

  /**
   * Staff Settings list: prefer live Core GET /api/v1/modules.
   * On failure/timeout/disabled → local modules.json (source local|pending).
   */
  async listModules(): Promise<ModuleStatus[]> {
    const fromCore = await this.tryFetchFromCore();
    if (fromCore) {
      return fromCore;
    }
    return MODULE_CATALOG.map((meta) => this.toStatus(meta.id));
  }

  getModule(id: string): ModuleStatus {
    if (!isModuleId(id)) {
      throw new NotFoundException(`Onbekende module: ${id}`);
    }
    return this.toStatus(id);
  }

  async patchModule(id: string, enabled: boolean): Promise<ModulePatchResult> {
    if (!isModuleId(id)) {
      throw new NotFoundException(`Onbekende module: ${id}`);
    }

    const stored = this.byId.get(id)!;
    stored.enabled = enabled;
    // Always persist local first; sync status updated after Core proxy attempt.
    this.persist();

    const push = await this.tryPushToCore(id, enabled);
    stored.source = push.source;
    this.persist();

    return {
      ...this.toStatus(id),
      syncStatus: push.syncStatus,
      softReload: true,
      note: push.note,
    };
  }

  /** EscapezCore / bridge consumers — same merge as Settings GET. */
  async listForBridge(): Promise<{ modules: ModuleStatus[] }> {
    return { modules: await this.listModules() };
  }

  private toStatus(id: ModuleId): ModuleStatus {
    const meta = MODULE_CATALOG.find((m) => m.id === id)!;
    const stored = this.byId.get(id)!;
    return {
      id,
      label: meta.label,
      enabled: stored.enabled,
      source: stored.source,
    };
  }

  private loadOrSeed(): void {
    let loaded: ModulesFileShape | null = null;
    try {
      if (existsSync(this.dataPath)) {
        const raw = readFileSync(this.dataPath, 'utf8');
        loaded = JSON.parse(raw) as ModulesFileShape;
      }
    } catch {
      loaded = null;
    }

    const fromFile = new Map<
      string,
      { enabled: boolean; source: ModuleSource }
    >();
    if (loaded?.modules && Array.isArray(loaded.modules)) {
      for (const row of loaded.modules) {
        if (!row || !isModuleId(row.id)) continue;
        fromFile.set(row.id, {
          enabled: !!row.enabled,
          source: normalizeSource(row.source),
        });
      }
    }

    this.byId.clear();
    for (const meta of MODULE_CATALOG) {
      const existing = fromFile.get(meta.id);
      this.byId.set(meta.id, {
        id: meta.id,
        enabled: existing?.enabled ?? meta.defaultEnabled,
        source: existing?.source ?? 'local',
      });
    }

    this.persist();
  }

  private persist(): void {
    const dir = dirname(this.dataPath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const payload: ModulesFileShape = {
      updatedAt: new Date().toISOString(),
      modules: MODULE_CATALOG.map((meta) => {
        const s = this.byId.get(meta.id)!;
        return {
          id: s.id,
          enabled: s.enabled,
          source: s.source,
        };
      }),
    };
    writeFileSync(this.dataPath, JSON.stringify(payload, null, 2), 'utf8');
  }

  /**
   * Resolve EscapezCore base URL.
   * - unset → http://127.0.0.1:8765
   * - CORE_API_BASE=off|disabled|false|none (or empty) → proxy disabled
   * - otherwise use the configured URL (trailing slash stripped)
   */
  private resolveCoreApiBase(): string | null {
    const raw = this.config.get<string>('CORE_API_BASE');
    if (raw === undefined || raw === null) {
      return DEFAULT_CORE_API_BASE;
    }
    const trimmed = String(raw).trim();
    if (!trimmed || /^(off|disabled|false|none)$/i.test(trimmed)) {
      return null;
    }
    return trimmed.replace(/\/$/, '');
  }

  private coreTimeoutMs(): number {
    const n = Number(this.config.get<string>('CORE_API_TIMEOUT_MS', '3000'));
    return Number.isFinite(n) && n > 0 ? n : 3000;
  }

  private coreHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Escapez-Api-Key': getBridgeApiKey(this.config),
    };
  }

  private async fetchCore(
    url: string,
    init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.coreTimeoutMs());
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * GET {CORE}/api/v1/modules → map to panel ModuleStatus with Dutch catalog labels.
   * Returns null when Core is disabled/offline/errors.
   */
  private async tryFetchFromCore(): Promise<ModuleStatus[] | null> {
    const base = this.resolveCoreApiBase();
    if (!base) {
      return null;
    }

    const url = `${base}/api/v1/modules`;
    try {
      const res = await this.fetchCore(url, {
        method: 'GET',
        headers: this.coreHeaders(),
      });
      if (!res.ok) {
        return null;
      }

      const data = (await res.json()) as {
        modules?: Array<{
          id?: unknown;
          enabled?: unknown;
          name?: unknown;
        }>;
      };
      if (!data?.modules || !Array.isArray(data.modules)) {
        return null;
      }

      const coreById = new Map<string, boolean>();
      for (const row of data.modules) {
        if (!row || typeof row.id !== 'string' || !isModuleId(row.id)) {
          continue;
        }
        coreById.set(row.id, !!row.enabled);
      }
      if (coreById.size === 0) {
        return null;
      }

      let dirty = false;
      for (const meta of MODULE_CATALOG) {
        const stored = this.byId.get(meta.id)!;
        if (coreById.has(meta.id)) {
          const enabled = coreById.get(meta.id)!;
          if (stored.enabled !== enabled || stored.source !== 'core') {
            stored.enabled = enabled;
            stored.source = 'core';
            dirty = true;
          }
        }
      }
      if (dirty) {
        this.persist();
      }

      return MODULE_CATALOG.map((meta) => ({
        id: meta.id,
        label: meta.label,
        enabled: this.byId.get(meta.id)!.enabled,
        source: (coreById.has(meta.id)
          ? 'core'
          : this.byId.get(meta.id)!.source) as ModuleSource,
      }));
    } catch {
      return null;
    }
  }

  /**
   * Panel → EscapezCore push.
   * PATCH {CORE}/api/v1/modules/:id {enabled} with X-Escapez-Api-Key (never Bearer).
   * On success → source=core, syncStatus=synced, soft-reload note from Core if present.
   * On failure → local already saved + pending + clear UI-facing note.
   */
  private async tryPushToCore(
    id: ModuleId,
    enabled: boolean,
  ): Promise<CorePushResult> {
    const base = this.resolveCoreApiBase();
    if (!base) {
      return {
        source: 'pending',
        syncStatus: 'pending',
        note: NOTE_CORE_DISABLED,
      };
    }

    const url = `${base}/api/v1/modules/${id}`;
    try {
      const res = await this.fetchCore(url, {
        method: 'PATCH',
        headers: this.coreHeaders(),
        body: JSON.stringify({ enabled }),
      });

      if (res.ok) {
        let note = NOTE_CORE_SOFT_RELOAD;
        try {
          const body = (await res.json()) as Record<string, unknown>;
          const fromCore =
            pickString(body.note) ??
            pickString(body.softReloadNote) ??
            pickString(body.message);
          if (fromCore) {
            note = fromCore;
          }
        } catch {
          // Core may return empty body; keep default note.
        }
        return { source: 'core', syncStatus: 'synced', note };
      }

      return {
        source: 'pending',
        syncStatus: 'pending',
        note: `Lokaal opgeslagen. EscapezCore antwoordde HTTP ${res.status} — sync pending.`,
      };
    } catch {
      return {
        source: 'pending',
        syncStatus: 'pending',
        note: NOTE_CORE_OFFLINE,
      };
    }
  }
}

function normalizeSource(value: unknown): ModuleSource {
  if (value === 'local' || value === 'core' || value === 'pending') {
    return value;
  }
  return 'local';
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

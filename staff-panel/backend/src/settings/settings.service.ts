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

const SOFT_RELOAD_NOTE =
  'soft-reload gevraagd (stub tot EscapezCore FASE 10 live is)';

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

  listModules(): ModuleStatus[] {
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

    const push = await this.tryPushToCore(id, enabled);
    stored.source = push.source;
    this.persist();

    return {
      ...this.toStatus(id),
      syncStatus: push.syncStatus,
      softReload: true,
      note: SOFT_RELOAD_NOTE,
    };
  }

  /** EscapezCore may later pull / push; today returns local catalog status. */
  listForBridge(): { modules: ModuleStatus[] } {
    return { modules: this.listModules() };
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

    const fromFile = new Map<string, { enabled: boolean; source: ModuleSource }>();
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
   * Panel → EscapezCore push stub.
   * When CORE_API_BASE is set: PATCH {CORE}/api/v1/modules/:id {enabled}.
   * On 503/timeout/error → local + pending.
   * When Core not configured → local persist + pending.
   */
  private async tryPushToCore(
    id: ModuleId,
    enabled: boolean,
  ): Promise<{ source: ModuleSource; syncStatus: SyncStatus }> {
    const base = (this.config.get<string>('CORE_API_BASE') ?? '').trim();
    if (!base) {
      return { source: 'pending', syncStatus: 'pending' };
    }

    const url = `${base.replace(/\/$/, '')}/api/v1/modules/${id}`;
    const key = getBridgeApiKey(this.config);
    const controller = new AbortController();
    const timeoutMs = Number(
      this.config.get<string>('CORE_API_TIMEOUT_MS', '3000'),
    );
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Escapez-Api-Key': key,
        },
        body: JSON.stringify({ enabled }),
        signal: controller.signal,
      });

      if (res.ok) {
        return { source: 'core', syncStatus: 'synced' };
      }
      // 503 / other → keep local, mark pending
      return { source: 'pending', syncStatus: 'pending' };
    } catch {
      return { source: 'pending', syncStatus: 'pending' };
    } finally {
      clearTimeout(timer);
    }
  }
}

function normalizeSource(value: unknown): ModuleSource {
  if (value === 'local' || value === 'core' || value === 'pending') {
    return value;
  }
  return 'local';
}

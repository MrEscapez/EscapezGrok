import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type PteroStoredCredentials = {
  baseUrl: string;
  /** Application API key (preferred for listing). Never sent to FE. */
  apiKey: string;
  /** Optional Client API key for power/resources. Never sent to FE. */
  clientApiKey: string;
  /** Optional default server identifier/uuid for single-server power. */
  defaultServerId: string;
};

export type PteroPublicConfig = {
  configured: boolean;
  baseUrlConfigured: boolean;
  /** Hostname only — never full URL with credentials. */
  baseUrlHost: string | null;
  apiKeyConfigured: boolean;
  /** Masked hint e.g. ptla_••••wxyz — never plaintext. */
  apiKeyHint: string | null;
  clientApiKeyConfigured: boolean;
  clientApiKeyHint: string | null;
  defaultServerIdConfigured: boolean;
  defaultServerIdHint: string | null;
  source: 'file' | 'env' | 'none';
};

type FileShape = Partial<PteroStoredCredentials>;

/**
 * Backend-only Pterodactyl credentials.
 * Priority: data/ptero.json (runtime) overlays env placeholders.
 * NEVER expose apiKey/clientApiKey plaintext via HTTP.
 */
@Injectable()
export class PteroCredentialsStore implements OnModuleInit {
  private readonly logger = new Logger(PteroCredentialsStore.name);
  private dataPath = '';
  private fileCreds: FileShape = {};
  private loadedFromFile = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const configured = this.config.get<string>('PTERO_DATA_PATH');
    this.dataPath =
      configured && configured.trim()
        ? configured.trim()
        : join(process.cwd(), 'data', 'ptero.json');
    this.loadFile();
  }

  getSecrets(): PteroStoredCredentials {
    const envUrl = (this.config.get<string>('PTERO_BASE_URL', '') || '').trim();
    const envKey = (this.config.get<string>('PTERO_API_KEY', '') || '').trim();
    const envClient = (
      this.config.get<string>('PTERO_CLIENT_API_KEY', '') || ''
    ).trim();
    const envServer = (
      this.config.get<string>('PTERO_SERVER_ID', '') || ''
    ).trim();

    const baseUrl = (this.fileCreds.baseUrl || envUrl || '').replace(/\/$/, '');
    const apiKey = this.pickSecret(this.fileCreds.apiKey, envKey);
    const clientApiKey = this.pickSecret(
      this.fileCreds.clientApiKey,
      envClient,
    );
    const defaultServerId = (
      this.fileCreds.defaultServerId ||
      envServer ||
      ''
    ).trim();

    return { baseUrl, apiKey, clientApiKey, defaultServerId };
  }

  /** True when Application API listing is possible (URL + app key). */
  isPanelConfigured(): boolean {
    const s = this.getSecrets();
    return Boolean(s.baseUrl && s.apiKey && s.apiKey !== 'CHANGE_ME');
  }

  /** True when client power/resources against default server is possible. */
  isClientPowerConfigured(): boolean {
    const s = this.getSecrets();
    const key = s.clientApiKey || s.apiKey;
    return Boolean(
      s.baseUrl &&
        key &&
        key !== 'CHANGE_ME' &&
        s.defaultServerId &&
        s.defaultServerId !== 'CHANGE_ME',
    );
  }

  toPublic(): PteroPublicConfig {
    const s = this.getSecrets();
    const source: PteroPublicConfig['source'] = this.loadedFromFile
      ? 'file'
      : s.baseUrl || s.apiKey
        ? 'env'
        : 'none';
    return {
      configured: this.isPanelConfigured(),
      baseUrlConfigured: Boolean(s.baseUrl),
      baseUrlHost: this.hostOf(s.baseUrl),
      apiKeyConfigured: Boolean(s.apiKey && s.apiKey !== 'CHANGE_ME'),
      apiKeyHint: this.mask(s.apiKey),
      clientApiKeyConfigured: Boolean(
        s.clientApiKey && s.clientApiKey !== 'CHANGE_ME',
      ),
      clientApiKeyHint: this.mask(s.clientApiKey),
      defaultServerIdConfigured: Boolean(
        s.defaultServerId && s.defaultServerId !== 'CHANGE_ME',
      ),
      defaultServerIdHint: s.defaultServerId
        ? this.maskId(s.defaultServerId)
        : null,
      source,
    };
  }

  save(input: {
    baseUrl?: string;
    apiKey?: string;
    clientApiKey?: string;
    defaultServerId?: string;
    clearApiKey?: boolean;
    clearClientApiKey?: boolean;
  }): PteroPublicConfig {
    if (typeof input.baseUrl === 'string') {
      this.fileCreds.baseUrl = input.baseUrl.trim().replace(/\/$/, '');
    }
    if (input.clearApiKey) {
      this.fileCreds.apiKey = '';
    } else if (typeof input.apiKey === 'string' && input.apiKey.trim()) {
      // Write-only: only replace when a new non-empty value is provided
      this.fileCreds.apiKey = input.apiKey.trim();
    }
    if (input.clearClientApiKey) {
      this.fileCreds.clientApiKey = '';
    } else if (
      typeof input.clientApiKey === 'string' &&
      input.clientApiKey.trim()
    ) {
      this.fileCreds.clientApiKey = input.clientApiKey.trim();
    }
    if (typeof input.defaultServerId === 'string') {
      this.fileCreds.defaultServerId = input.defaultServerId.trim();
    }
    this.persist();
    this.loadedFromFile = true;
    this.logger.log('Pterodactyl credentials updated (secrets not logged)');
    return this.toPublic();
  }

  private pickSecret(fileVal: string | undefined, envVal: string): string {
    if (fileVal !== undefined && fileVal !== null) {
      const t = String(fileVal).trim();
      if (t) return t;
      // explicit empty in file clears env overlay for that field
      if (this.loadedFromFile && fileVal === '') return '';
    }
    return envVal;
  }

  private hostOf(url: string): string | null {
    if (!url) return null;
    try {
      return new URL(url.includes('://') ? url : `https://${url}`).host;
    } catch {
      return url.replace(/^https?:\/\//, '').split('/')[0] || null;
    }
  }

  private mask(secret: string): string | null {
    if (!secret || secret === 'CHANGE_ME') return null;
    if (secret.length <= 8) return '••••';
    return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
  }

  private maskId(id: string): string | null {
    if (!id) return null;
    if (id.length <= 6) return `${id[0]}•••`;
    return `${id.slice(0, 4)}…${id.slice(-2)}`;
  }

  private loadFile(): void {
    try {
      if (!existsSync(this.dataPath)) {
        this.loadedFromFile = false;
        return;
      }
      const raw = readFileSync(this.dataPath, 'utf8');
      const parsed = JSON.parse(raw) as FileShape;
      this.fileCreds = {
        baseUrl: typeof parsed.baseUrl === 'string' ? parsed.baseUrl : '',
        apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
        clientApiKey:
          typeof parsed.clientApiKey === 'string' ? parsed.clientApiKey : '',
        defaultServerId:
          typeof parsed.defaultServerId === 'string'
            ? parsed.defaultServerId
            : '',
      };
      this.loadedFromFile = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Could not load ptero.json: ${msg}`);
      this.loadedFromFile = false;
    }
  }

  private persist(): void {
    const dir = dirname(this.dataPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: FileShape = {
      baseUrl: this.fileCreds.baseUrl || '',
      apiKey: this.fileCreds.apiKey || '',
      clientApiKey: this.fileCreds.clientApiKey || '',
      defaultServerId: this.fileCreds.defaultServerId || '',
    };
    writeFileSync(this.dataPath, `${JSON.stringify(payload, null, 2)}\n`, {
      mode: 0o600,
    });
  }
}

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type DiscordBridgeStoredCredentials = {
  /** Shared secret between Discord bridge bot and Staff Panel. Never sent to FE. */
  bridgeSecret: string;
};

export type DiscordBridgePublicConfig = {
  configured: boolean;
  /** Masked hint — never plaintext. */
  secretHint: string | null;
  source: 'file' | 'env' | 'none';
  /** Dutch setup help for Settings UI. */
  helpNl: {
    title: string;
    steps: string[];
  };
  bridgeEndpointsHint: string[];
};

type FileShape = Partial<DiscordBridgeStoredCredentials>;

/**
 * Backend-only Discord ticket-bridge secret.
 * Priority: data/discord-bridge.json overlays env DISCORD_BRIDGE_SECRET.
 * NEVER expose bridgeSecret plaintext via HTTP.
 */
@Injectable()
export class DiscordBridgeCredentialsStore implements OnModuleInit {
  private readonly logger = new Logger(DiscordBridgeCredentialsStore.name);
  private dataPath = '';
  private fileCreds: FileShape = {};
  private loadedFromFile = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const configured = this.config.get<string>('DISCORD_BRIDGE_DATA_PATH');
    this.dataPath =
      configured && configured.trim()
        ? configured.trim()
        : join(process.cwd(), 'data', 'discord-bridge.json');
    this.loadFile();
  }

  getSecret(): string {
    const envSecret = (
      this.config.get<string>('DISCORD_BRIDGE_SECRET', '') || ''
    ).trim();
    return this.pickSecret(this.fileCreds.bridgeSecret, envSecret);
  }

  isConfigured(): boolean {
    const s = this.getSecret();
    return Boolean(s && s !== 'CHANGE_ME');
  }

  toPublic(): DiscordBridgePublicConfig {
    const s = this.getSecret();
    const source: DiscordBridgePublicConfig['source'] = this.loadedFromFile
      ? 'file'
      : s
        ? 'env'
        : 'none';
    return {
      configured: this.isConfigured(),
      secretHint: this.mask(s),
      source,
      helpNl: {
        title: 'Discord Bridge (gratis Ticket Tool)',
        steps: [
          'Maak een Discord-bot in de Developer Portal en zet Message Content Intent aan.',
          'Invite de bot met: View Channels, Read Message History, Read Messages.',
          'Kopieer de category-ID(s) van de Ticket Tool ticket-categorie(ën) naar TICKET_CATEGORY_IDS op de bridge-bot.',
          'Zet hieronder hetzelfde bridge-secret als STAFF_PANEL_BRIDGE_SECRET op de bot.',
          'Start staff-panel/discord-ticket-bridge (npm run build && npm start).',
        ],
      },
      bridgeEndpointsHint: [
        'POST /api/v1/tickets/bridge/upsert',
        'POST /api/v1/tickets/bridge/message',
        'POST /api/v1/tickets/bridge/close',
      ],
    };
  }

  save(input: {
    bridgeSecret?: string;
    clearBridgeSecret?: boolean;
  }): DiscordBridgePublicConfig {
    if (input.clearBridgeSecret) {
      this.fileCreds.bridgeSecret = '';
    } else if (
      typeof input.bridgeSecret === 'string' &&
      input.bridgeSecret.trim()
    ) {
      this.fileCreds.bridgeSecret = input.bridgeSecret.trim();
    }
    this.persist();
    this.loadedFromFile = true;
    this.logger.log('Discord bridge credentials updated (secret not logged)');
    return this.toPublic();
  }

  private pickSecret(fileVal: string | undefined, envVal: string): string {
    if (fileVal !== undefined && fileVal !== null) {
      const t = String(fileVal).trim();
      if (t) return t;
      if (this.loadedFromFile && fileVal === '') return '';
    }
    return envVal;
  }

  private mask(secret: string): string | null {
    if (!secret || secret === 'CHANGE_ME') return null;
    if (secret.length <= 8) return '••••';
    return `${secret.slice(0, 4)}••••${secret.slice(-4)}`;
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
        bridgeSecret:
          typeof parsed.bridgeSecret === 'string' ? parsed.bridgeSecret : '',
      };
      this.loadedFromFile = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Could not load discord-bridge.json: ${msg}`);
      this.loadedFromFile = false;
    }
  }

  private persist(): void {
    const dir = dirname(this.dataPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: FileShape = {
      bridgeSecret: this.fileCreds.bridgeSecret || '',
    };
    writeFileSync(this.dataPath, `${JSON.stringify(payload, null, 2)}\n`, {
      mode: 0o600,
    });
  }
}

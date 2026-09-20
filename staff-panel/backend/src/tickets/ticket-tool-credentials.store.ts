import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';

export type TicketToolStoredCredentials = {
  /** Ticket Tool API token (tt_…). Never sent to FE. */
  apiToken: string;
  /** Webhook HMAC signing secret. Never sent to FE. */
  webhookSecret: string;
};

export type TicketToolPublicConfig = {
  configured: boolean;
  apiTokenConfigured: boolean;
  /** Masked hint e.g. tt_a••••xyz — never plaintext. */
  apiTokenHint: string | null;
  webhookSecretConfigured: boolean;
  webhookSecretHint: string | null;
  source: 'file' | 'env' | 'none';
  /** Dutch help: webhook URL staff must register in Ticket Tool. */
  webhookUrlHint: string;
  /** Events to subscribe when registering the webhook. */
  webhookEventsHint: string[];
};

type FileShape = Partial<TicketToolStoredCredentials>;

export const TICKET_TOOL_WEBHOOK_EVENTS = [
  'TICKET_CREATED',
  'TICKET_UPDATED',
  'TICKET_CLOSED',
  'TICKET_REOPENED',
  'TICKET_CLAIMED',
  'TICKET_UNCLAIMED',
  'TICKET_DELETED',
  'TICKET_MESSAGE_CREATED',
] as const;

/**
 * Backend-only Ticket Tool credentials.
 * Priority: data/ticket-tool.json overlays env.
 * NEVER expose apiToken / webhookSecret plaintext via HTTP.
 */
@Injectable()
export class TicketToolCredentialsStore implements OnModuleInit {
  private readonly logger = new Logger(TicketToolCredentialsStore.name);
  private dataPath = '';
  private fileCreds: FileShape = {};
  private loadedFromFile = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const configured = this.config.get<string>('TICKET_TOOL_DATA_PATH');
    this.dataPath =
      configured && configured.trim()
        ? configured.trim()
        : join(process.cwd(), 'data', 'ticket-tool.json');
    this.loadFile();
  }

  getSecrets(): TicketToolStoredCredentials {
    const envToken = (
      this.config.get<string>('TICKET_TOOL_API_TOKEN', '') || ''
    ).trim();
    const envSecret = (
      this.config.get<string>('TICKET_TOOL_WEBHOOK_SECRET', '') || ''
    ).trim();
    return {
      apiToken: this.pickSecret(this.fileCreds.apiToken, envToken),
      webhookSecret: this.pickSecret(this.fileCreds.webhookSecret, envSecret),
    };
  }

  isApiConfigured(): boolean {
    const s = this.getSecrets();
    return Boolean(s.apiToken && s.apiToken !== 'CHANGE_ME');
  }

  isWebhookConfigured(): boolean {
    const s = this.getSecrets();
    return Boolean(s.webhookSecret && s.webhookSecret !== 'CHANGE_ME');
  }

  toPublic(): TicketToolPublicConfig {
    const s = this.getSecrets();
    const source: TicketToolPublicConfig['source'] = this.loadedFromFile
      ? 'file'
      : s.apiToken || s.webhookSecret
        ? 'env'
        : 'none';
    return {
      configured: this.isApiConfigured(),
      apiTokenConfigured: this.isApiConfigured(),
      apiTokenHint: this.mask(s.apiToken),
      webhookSecretConfigured: this.isWebhookConfigured(),
      webhookSecretHint: this.mask(s.webhookSecret),
      source,
      webhookUrlHint: 'https://staff.escapez.be/api/v1/tickets/webhook',
      webhookEventsHint: [...TICKET_TOOL_WEBHOOK_EVENTS],
    };
  }

  save(input: {
    apiToken?: string;
    webhookSecret?: string;
    clearApiToken?: boolean;
    clearWebhookSecret?: boolean;
  }): TicketToolPublicConfig {
    if (input.clearApiToken) {
      this.fileCreds.apiToken = '';
    } else if (typeof input.apiToken === 'string' && input.apiToken.trim()) {
      this.fileCreds.apiToken = input.apiToken.trim();
    }
    if (input.clearWebhookSecret) {
      this.fileCreds.webhookSecret = '';
    } else if (
      typeof input.webhookSecret === 'string' &&
      input.webhookSecret.trim()
    ) {
      this.fileCreds.webhookSecret = input.webhookSecret.trim();
    }
    this.persist();
    this.loadedFromFile = true;
    this.logger.log('Ticket Tool credentials updated (secrets not logged)');
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
        apiToken: typeof parsed.apiToken === 'string' ? parsed.apiToken : '',
        webhookSecret:
          typeof parsed.webhookSecret === 'string' ? parsed.webhookSecret : '',
      };
      this.loadedFromFile = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown';
      this.logger.warn(`Could not load ticket-tool.json: ${msg}`);
      this.loadedFromFile = false;
    }
  }

  private persist(): void {
    const dir = dirname(this.dataPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const payload: FileShape = {
      apiToken: this.fileCreds.apiToken || '',
      webhookSecret: this.fileCreds.webhookSecret || '',
    };
    writeFileSync(this.dataPath, `${JSON.stringify(payload, null, 2)}\n`, {
      mode: 0o600,
    });
  }
}

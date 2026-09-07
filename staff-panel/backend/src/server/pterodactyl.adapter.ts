import { Injectable, Logger } from '@nestjs/common';
import { PteroCredentialsStore } from './ptero-credentials.store';

export type PteroPowerState =
  | 'running'
  | 'starting'
  | 'stopping'
  | 'offline'
  | 'unknown';

export type PteroResources = {
  configured: boolean;
  stub: boolean;
  state: PteroPowerState;
  currentState?: string;
  isSuspended?: boolean;
  memoryBytes?: number;
  cpuAbsolute?: number;
  diskBytes?: number;
  message?: string;
};

export type PteroPowerResult = {
  ok: boolean;
  stub: boolean;
  action: string;
  message: string;
  httpStatus?: number;
};

export type PteroServerSummary = {
  id: number | string;
  identifier: string;
  uuid: string;
  name: string;
  description: string;
  suspended: boolean;
  status: string | null;
  node?: number | string;
  power: PteroPowerState;
  playersOnline?: number;
  maxPlayers?: number;
};

export type PteroListResult = {
  configured: boolean;
  stub: boolean;
  items: PteroServerSummary[];
  message?: string;
};

export type PteroTestResult = {
  ok: boolean;
  stub: boolean;
  message: string;
  httpStatus?: number;
  serverCount?: number;
};

/**
 * Pterodactyl adapter — Application API for listing, Client API for power.
 * Credentials ONLY via PteroCredentialsStore (env + data/ptero.json).
 * Responses NEVER include API keys or passwords.
 */
@Injectable()
export class PterodactylAdapter {
  private readonly logger = new Logger(PterodactylAdapter.name);

  constructor(private readonly creds: PteroCredentialsStore) {}

  /** Panel URL + Application API key present. */
  isPanelConfigured(): boolean {
    return this.creds.isPanelConfigured();
  }

  /** Default server power via Client API possible. */
  isConfigured(): boolean {
    return this.creds.isClientPowerConfigured();
  }

  async testConnection(): Promise<PteroTestResult> {
    if (!this.isPanelConfigured()) {
      return {
        ok: false,
        stub: true,
        message:
          'Pterodactyl niet geconfigureerd. Vul panel-URL en Application API-key in bij Instellingen.',
      };
    }
    const s = this.creds.getSecrets();
    const url = `${s.baseUrl}/api/application/servers?per_page=1`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.appHeaders(s.apiKey),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Ptero test HTTP ${res.status}`);
        return {
          ok: false,
          stub: false,
          message: `Verbindingstest mislukt (HTTP ${res.status}). Controleer URL en Application API-key.`,
          httpStatus: res.status,
        };
      }
      const json = (await res.json()) as {
        meta?: { pagination?: { total?: number } };
        data?: unknown[];
      };
      const total =
        json.meta?.pagination?.total ??
        (Array.isArray(json.data) ? json.data.length : 0);
      return {
        ok: true,
        stub: false,
        message: `Verbinding OK — Application API bereikbaar (${total} server(s)).`,
        httpStatus: res.status,
        serverCount: total,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Ptero test failed: ${msg}`);
      return {
        ok: false,
        stub: false,
        message: 'Pterodactyl niet bereikbaar (timeout/netwerk).',
      };
    }
  }

  async listServers(): Promise<PteroListResult> {
    if (!this.isPanelConfigured()) {
      return {
        configured: false,
        stub: true,
        items: [],
        message:
          'Geen Pterodactyl-credentials. Configureer panel-URL + API-key onder Instellingen.',
      };
    }

    const s = this.creds.getSecrets();
    const url = `${s.baseUrl}/api/application/servers?per_page=100&include=node`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.appHeaders(s.apiKey),
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) {
        this.logger.warn(`Ptero list HTTP ${res.status}`);
        return {
          configured: true,
          stub: false,
          items: [],
          message: `Servers ophalen mislukt (HTTP ${res.status})`,
        };
      }
      const json = (await res.json()) as {
        data?: Array<{
          attributes?: {
            id?: number;
            external_id?: string | null;
            uuid?: string;
            identifier?: string;
            name?: string;
            description?: string;
            suspended?: boolean;
            status?: string | null;
            node?: number;
          };
        }>;
      };
      const items: PteroServerSummary[] = (json.data ?? []).map((row) => {
        const a = row.attributes ?? {};
        const identifier = String(a.identifier || a.uuid || a.id || '');
        return {
          id: a.id ?? identifier,
          identifier,
          uuid: String(a.uuid || ''),
          name: String(a.name || identifier || 'Onbekend'),
          description: String(a.description || ''),
          suspended: Boolean(a.suspended),
          status: a.status ?? null,
          node: a.node,
          power: a.suspended
            ? 'offline'
            : a.status
              ? 'unknown'
              : 'unknown',
        };
      });

      // Best-effort live power via Client API when client key present
      const clientKey = s.clientApiKey || '';
      if (clientKey && clientKey !== 'CHANGE_ME') {
        await Promise.all(
          items.slice(0, 20).map(async (item) => {
            const power = await this.fetchClientPower(item.identifier, clientKey);
            if (power) item.power = power;
          }),
        );
      }

      return {
        configured: true,
        stub: false,
        items,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Ptero list failed: ${msg}`);
      return {
        configured: true,
        stub: false,
        items: [],
        message: 'Pterodactyl niet bereikbaar bij ophalen van servers',
      };
    }
  }

  async getPowerState(): Promise<PteroPowerState> {
    const res = await this.getServerResources();
    return res.state;
  }

  async getServerResources(): Promise<PteroResources> {
    if (!this.isConfigured()) {
      return {
        configured: false,
        stub: true,
        state: 'unknown',
        message:
          'Pterodactyl client power niet geconfigureerd (stub). Zet default server + Client API-key of Application key + server-id.',
      };
    }

    const s = this.creds.getSecrets();
    const key = s.clientApiKey || s.apiKey;
    const serverId = s.defaultServerId;
    const url = `${s.baseUrl}/api/client/servers/${serverId}/resources`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.clientHeaders(key),
        signal: AbortSignal.timeout(8_000),
      });

      if (!res.ok) {
        this.logger.warn(`Ptero resources HTTP ${res.status}`);
        return {
          configured: true,
          stub: false,
          state: 'unknown',
          message: `Pterodactyl resources fout (HTTP ${res.status})`,
        };
      }

      const json = (await res.json()) as {
        attributes?: {
          current_state?: string;
          is_suspended?: boolean;
          resources?: {
            memory_bytes?: number;
            cpu_absolute?: number;
            disk_bytes?: number;
          };
        };
      };
      const attrs = json.attributes ?? {};
      const current = (attrs.current_state || 'unknown').toLowerCase();
      return {
        configured: true,
        stub: false,
        state: this.mapState(current),
        currentState: current,
        isSuspended: attrs.is_suspended,
        memoryBytes: attrs.resources?.memory_bytes,
        cpuAbsolute: attrs.resources?.cpu_absolute,
        diskBytes: attrs.resources?.disk_bytes,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Ptero resources failed: ${msg}`);
      return {
        configured: true,
        stub: false,
        state: 'unknown',
        message: 'Pterodactyl niet bereikbaar',
      };
    }
  }

  async setPower(
    action: 'start' | 'stop' | 'restart' | 'kill',
    serverIdentifier?: string,
  ): Promise<PteroPowerResult> {
    const s = this.creds.getSecrets();
    const key = s.clientApiKey || s.apiKey;
    const serverId = (serverIdentifier || s.defaultServerId || '').trim();

    if (
      !s.baseUrl ||
      !key ||
      key === 'CHANGE_ME' ||
      !serverId ||
      serverId === 'CHANGE_ME'
    ) {
      return {
        ok: true,
        stub: true,
        action,
        message: `Pterodactyl stub: power '${action}' gesimuleerd (client power niet geconfigureerd).`,
      };
    }

    const url = `${s.baseUrl}/api/client/servers/${serverId}/power`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          ...this.clientHeaders(key),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signal: action }),
        signal: AbortSignal.timeout(15_000),
      });

      if (res.status === 204 || res.ok) {
        return {
          ok: true,
          stub: false,
          action,
          message: `Power-signaal '${action}' verzonden naar Pterodactyl.`,
          httpStatus: res.status,
        };
      }

      this.logger.warn(`Ptero power HTTP ${res.status}`);
      return {
        ok: false,
        stub: false,
        action,
        message: `Pterodactyl power mislukt (HTTP ${res.status})`,
        httpStatus: res.status,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Ptero power failed: ${msg}`);
      return {
        ok: false,
        stub: false,
        action,
        message: 'Pterodactyl niet bereikbaar voor power-actie',
      };
    }
  }

  private async fetchClientPower(
    identifier: string,
    clientKey: string,
  ): Promise<PteroPowerState | null> {
    if (!identifier) return null;
    const s = this.creds.getSecrets();
    try {
      const res = await fetch(
        `${s.baseUrl}/api/client/servers/${identifier}/resources`,
        {
          method: 'GET',
          headers: this.clientHeaders(clientKey),
          signal: AbortSignal.timeout(5_000),
        },
      );
      if (!res.ok) return null;
      const json = (await res.json()) as {
        attributes?: { current_state?: string };
      };
      const current = (json.attributes?.current_state || '').toLowerCase();
      return this.mapState(current);
    } catch {
      return null;
    }
  }

  private appHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/vnd.pterodactyl.v1+json',
      'Content-Type': 'application/json',
    };
  }

  private clientHeaders(apiKey: string): Record<string, string> {
    return {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };
  }

  private mapState(current: string): PteroPowerState {
    if (current === 'running') return 'running';
    if (current === 'starting') return 'starting';
    if (current === 'stopping') return 'stopping';
    if (current === 'offline') return 'offline';
    return 'unknown';
  }
}

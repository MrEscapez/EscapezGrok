import { Injectable, Logger } from '@nestjs/common';
import WebSocket from 'ws';
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

export type PteroWebsocketCredentials = {
  configured: boolean;
  stub: boolean;
  token?: string;
  socket?: string;
  serverIdentifier?: string;
  message?: string;
};

export type PteroConsoleCommandResult = {
  ok: boolean;
  stub: boolean;
  message: string;
  command: string;
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


  /** Client API key present (required for console websocket). */
  isClientApiKeyConfigured(): boolean {
    return this.creds.isClientApiKeyConfigured();
  }

  /**
   * Fetch short-lived Ptero Client websocket credentials.
   * Never returns the clientApiKey itself — only token + socket URL.
   */
  async getWebsocketCredentials(
    serverIdentifier?: string,
  ): Promise<PteroWebsocketCredentials> {
    if (!this.isClientApiKeyConfigured()) {
      return {
        configured: false,
        stub: true,
        message:
          'Client API-key ontbreekt. Configureer een Pterodactyl Client API-key onder Instellingen om de live console te gebruiken.',
      };
    }

    const s = this.creds.getSecrets();
    const serverId = (serverIdentifier || s.defaultServerId || '').trim();
    if (!serverId || serverId === 'CHANGE_ME') {
      return {
        configured: true,
        stub: true,
        message:
          'Geen server geselecteerd. Kies een server of stel een default server-id in onder Instellingen.',
      };
    }

    const url = `${s.baseUrl}/api/client/servers/${encodeURIComponent(serverId)}/websocket`;
    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: this.clientHeaders(s.clientApiKey),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        this.logger.warn(`Ptero websocket HTTP ${res.status}`);
        return {
          configured: true,
          stub: false,
          serverIdentifier: serverId,
          message: `Console-credentials ophalen mislukt (HTTP ${res.status}). Controleer Client API-key en server-id.`,
        };
      }
      const json = (await res.json()) as {
        data?: { token?: string; socket?: string };
      };
      const token = json.data?.token;
      const socket = json.data?.socket;
      if (!token || !socket) {
        return {
          configured: true,
          stub: false,
          serverIdentifier: serverId,
          message: 'Pterodactyl gaf geen geldige websocket-credentials terug.',
        };
      }
      return {
        configured: true,
        stub: false,
        token,
        socket,
        serverIdentifier: serverId,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.warn(`Ptero websocket failed: ${msg}`);
      return {
        configured: true,
        stub: false,
        serverIdentifier: serverId,
        message: 'Pterodactyl niet bereikbaar voor console-websocket.',
      };
    }
  }

  /**
   * Send one console command via a short-lived Ptero websocket (backend-only).
   * Uses clientApiKey — never exposed to the frontend.
   */
  async sendConsoleCommand(
    command: string,
    serverIdentifier?: string,
  ): Promise<PteroConsoleCommandResult> {
    const sanitized = command.replace(/[\x00-\x1f\x7f]/g, '').trim();
    if (!sanitized) {
      return {
        ok: false,
        stub: false,
        command: '',
        message: 'Leeg console-commando.',
      };
    }
    if (sanitized.length > 500) {
      return {
        ok: false,
        stub: false,
        command: sanitized.slice(0, 500),
        message: 'Commando te lang (max 500 tekens).',
      };
    }

    const creds = await this.getWebsocketCredentials(serverIdentifier);
    if (!creds.token || !creds.socket) {
      return {
        ok: false,
        stub: creds.stub,
        command: sanitized,
        message: creds.message || 'Geen console-credentials beschikbaar.',
      };
    }

    return new Promise<PteroConsoleCommandResult>((resolve) => {
      let settled = false;
      const finish = (result: PteroConsoleCommandResult) => {
        if (settled) return;
        settled = true;
        try {
          ws.close();
        } catch {
          /* ignore */
        }
        resolve(result);
      };

      const ws = new WebSocket(creds.socket!);
      const timer = setTimeout(() => {
        finish({
          ok: false,
          stub: false,
          command: sanitized,
          message: 'Timeout bij verzenden van console-commando.',
        });
      }, 12_000);

      ws.on('open', () => {
        ws.send(JSON.stringify({ event: 'auth', args: [creds.token] }));
      });

      ws.on('message', (raw) => {
        let parsed: { event?: string } = {};
        try {
          parsed = JSON.parse(String(raw)) as { event?: string };
        } catch {
          return;
        }
        if (parsed.event === 'auth success') {
          ws.send(
            JSON.stringify({ event: 'send command', args: [sanitized] }),
          );
          clearTimeout(timer);
          finish({
            ok: true,
            stub: false,
            command: sanitized,
            message: 'Commando verzonden naar console.',
          });
        } else if (parsed.event === 'auth error' || parsed.event === 'jwt error') {
          clearTimeout(timer);
          finish({
            ok: false,
            stub: false,
            command: sanitized,
            message: 'Console-authenticatie mislukt (ongeldige of verlopen token).',
          });
        }
      });

      ws.on('error', () => {
        clearTimeout(timer);
        finish({
          ok: false,
          stub: false,
          command: sanitized,
          message: 'Websocket-fout bij verzenden van console-commando.',
        });
      });

      ws.on('close', () => {
        clearTimeout(timer);
        if (!settled) {
          finish({
            ok: false,
            stub: false,
            command: sanitized,
            message: 'Websocket gesloten vóór bevestiging.',
          });
        }
      });
    });
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

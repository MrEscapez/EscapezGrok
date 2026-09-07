import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PterodactylAdapter } from './pterodactyl.adapter';
import { RconAdapter } from './rcon.adapter';

/** Safe commands that may run without confirm. */
const RCON_SAFE_ALLOWLIST = new Set([
  'list',
  'tps',
  'help',
  'version',
  'plugins',
  'whitelist list',
  'forge tps',
]);

/** Dangerous first tokens — require confirm:true (denylist stub). */
const RCON_DANGEROUS_PREFIXES = [
  'op',
  'deop',
  'stop',
  'restart',
  'kill',
  'ban',
  'ban-ip',
  'pardon',
  'pardon-ip',
  'whitelist add',
  'whitelist remove',
  'whitelist on',
  'whitelist off',
  'gamemode',
  'give',
  'execute',
  'reload',
  'save-all',
  'save-off',
  'save-on',
  'kick',
  'lp',
  'luckperms',
  'pex',
];

export type ServerStatusResponse = {
  power: 'online' | 'offline' | 'unknown';
  playersOnline?: number;
  maxPlayers?: number;
  source: 'rcon' | 'ptero' | 'stub';
  pterodactyl?: { state: string };
  rconConfigured: boolean;
  pteroConfigured: boolean;
  stub: boolean;
  message?: string;
};

@Injectable()
export class ServerService {
  constructor(
    private readonly ptero: PterodactylAdapter,
    private readonly rcon: RconAdapter,
  ) {}

  async getStatus(): Promise<ServerStatusResponse> {
    const rconConfigured = this.rcon.isConfigured();
    const pteroConfigured = this.ptero.isPanelConfigured();
    const pteroClientPower = this.ptero.isConfigured();

    if (!rconConfigured && !pteroConfigured) {
      return {
        power: 'unknown',
        source: 'stub',
        rconConfigured: false,
        pteroConfigured: false,
        stub: true,
        message:
          'Server-integratie in stub-modus: RCON en Pterodactyl niet geconfigureerd.',
      };
    }

    if (pteroConfigured) {
      let power: 'online' | 'offline' | 'unknown' = 'unknown';
      let pteroState = 'unknown';
      let stub = !pteroClientPower;
      let message: string | undefined =
        'Pterodactyl Application API geconfigureerd. Zie serverlijst voor details.';

      if (pteroClientPower) {
        const resources = await this.ptero.getServerResources();
        power =
          resources.state === 'running'
            ? 'online'
            : resources.state === 'offline'
              ? 'offline'
              : 'unknown';
        pteroState = resources.state;
        stub = resources.stub;
        message = resources.message;
      }

      let playersOnline: number | undefined;
      let maxPlayers: number | undefined;
      if (rconConfigured) {
        const list = await this.tryParseList();
        playersOnline = list?.online;
        maxPlayers = list?.max;
      }

      return {
        power,
        playersOnline,
        maxPlayers,
        source: 'ptero',
        pterodactyl: { state: pteroState },
        rconConfigured,
        pteroConfigured: true,
        stub,
        message,
      };
    }

    // RCON only
    const list = await this.tryParseList();
    return {
      power: list ? 'online' : 'unknown',
      playersOnline: list?.online,
      maxPlayers: list?.max,
      source: 'rcon',
      rconConfigured: true,
      pteroConfigured: false,
      stub: false,
      message: list
        ? undefined
        : 'RCON geconfigureerd maar status onbekend (list mislukt of server offline).',
    };
  }

  async powerAction(
    action: 'start' | 'stop' | 'restart',
    confirm: boolean,
    serverIdentifier?: string,
  ): Promise<{
    ok: boolean;
    stub: boolean;
    action: string;
    message: string;
    pteroConfigured: boolean;
  }> {
    if (confirm !== true) {
      throw new BadRequestException(
        'Bevestiging vereist: stuur { confirm: true } voor power-acties.',
      );
    }

    const result = await this.ptero.setPower(action, serverIdentifier);
    return {
      ok: result.ok,
      stub: result.stub,
      action: result.action,
      message: result.message,
      pteroConfigured: this.ptero.isPanelConfigured(),
    };
  }

  async listServers() {
    return this.ptero.listServers();
  }


  async runRcon(
    command: string,
    confirm?: boolean,
  ): Promise<{
    ok: boolean;
    stub: boolean;
    connected: boolean;
    command: string;
    response?: string;
    message: string;
    requiredConfirm?: boolean;
  }> {
    const sanitized = this.rcon.sanitizeCommand(command);
    if (!sanitized) {
      throw new BadRequestException('Leeg commando');
    }

    const needsConfirm = this.commandNeedsConfirm(sanitized);
    if (needsConfirm && confirm !== true) {
      throw new BadRequestException(
        `Gevaarlijk of onbekend RCON-commando vereist confirm: true (denylist/allowlist stub). Commando: ${sanitized.split(' ')[0]}`,
      );
    }

    if (!this.rcon.isConfigured()) {
      // Explicit 503-style messaging via exception for "not configured"
      const stub = await this.rcon.send(sanitized);
      throw new ServiceUnavailableException({
        statusCode: 503,
        message: stub.message,
        stub: true,
        command: sanitized,
        rconConfigured: false,
      });
    }

    const result = await this.rcon.send(sanitized);
    return {
      ok: result.ok,
      stub: result.stub,
      connected: result.connected,
      command: result.commandSanitized,
      response: result.response,
      message: result.message,
      requiredConfirm: needsConfirm,
    };
  }

  /** Public for UI hints — first tokens / known safe cmds only. */
  listSafeCommands(): string[] {
    return [...RCON_SAFE_ALLOWLIST];
  }

  private commandNeedsConfirm(command: string): boolean {
    const lower = command.toLowerCase();
    if (RCON_SAFE_ALLOWLIST.has(lower)) {
      return false;
    }
    // Exact first-word allowlist match (e.g. "list")
    const first = lower.split(/\s+/)[0] ?? '';
    if (RCON_SAFE_ALLOWLIST.has(first) && lower === first) {
      return false;
    }
    for (const prefix of RCON_DANGEROUS_PREFIXES) {
      if (lower === prefix || lower.startsWith(`${prefix} `)) {
        return true;
      }
    }
    // Unknown commands also require confirm
    return true;
  }

  private async tryParseList(): Promise<
    { online: number; max: number } | undefined
  > {
    try {
      const result = await this.rcon.send('list');
      if (!result.ok || !result.response) return undefined;
      // Typical: "There are 3 of a max of 20 players online:"
      const m = result.response.match(
        /(\d+)\s+of\s+(?:a\s+max\s+of\s+)?(\d+)/i,
      );
      if (m) {
        return { online: Number(m[1]), max: Number(m[2]) };
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}

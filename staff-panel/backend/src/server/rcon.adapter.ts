import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type RconSendResult = {
  ok: boolean;
  stub: boolean;
  connected: boolean;
  commandSanitized: string;
  response?: string;
  message: string;
};

/**
 * Minecraft RCON adapter.
 * Host/port/password ONLY from backend env — never echoed to clients.
 * When RCON_* incomplete → stub (not connected).
 */
@Injectable()
export class RconAdapter {
  private readonly logger = new Logger(RconAdapter.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    const host = this.host();
    const password = this.password();
    return Boolean(
      host &&
        password &&
        password !== 'CHANGE_ME' &&
        Number.isFinite(this.port()),
    );
  }

  private host(): string {
    return this.config.get<string>('RCON_HOST', '') || '';
  }

  private port(): number {
    return Number(this.config.get<string>('RCON_PORT', '25575'));
  }

  private password(): string {
    return this.config.get<string>('RCON_PASSWORD', '') || '';
  }

  /** Sanitize for logs — never log password or full sensitive payloads. */
  sanitizeCommand(command: string): string {
    return command.replace(/\s+/g, ' ').trim().slice(0, 120);
  }

  async send(command: string): Promise<RconSendResult> {
    const sanitized = this.sanitizeCommand(command);

    if (!this.isConfigured()) {
      this.logger.log(`[stub] RCON not configured; would send: ${sanitized}`);
      return {
        ok: false,
        stub: true,
        connected: false,
        commandSanitized: sanitized,
        message:
          'RCON niet geconfigureerd (stub). Zet RCON_HOST, RCON_PORT, RCON_PASSWORD in backend .env.',
      };
    }

    try {
      // Dynamic import so a broken install still allows stub builds
      const { Rcon } = await import('rcon-client');
      const rcon = await Rcon.connect({
        host: this.host(),
        port: this.port(),
        password: this.password(),
        timeout: 5_000,
      });

      try {
        this.logger.log(`RCON send: ${sanitized}`);
        const response = await rcon.send(sanitized);
        return {
          ok: true,
          stub: false,
          connected: true,
          commandSanitized: sanitized,
          response: typeof response === 'string' ? response.slice(0, 4000) : '',
          message: 'RCON-commando uitgevoerd.',
        };
      } finally {
        rcon.end();
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      // Never include password in error text returned upstream
      const safe =
        msg.replace(this.password(), '[redacted]').slice(0, 200) ||
        'RCON-verbinding mislukt';
      this.logger.warn(`RCON failed for '${sanitized}': ${safe}`);
      return {
        ok: false,
        stub: false,
        connected: false,
        commandSanitized: sanitized,
        message: `RCON fout: ${safe}`,
      };
    }
  }
}

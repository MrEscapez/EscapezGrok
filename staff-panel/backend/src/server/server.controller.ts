import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  MessageEvent,
  Post,
  Query,
  Req,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { RateLimit } from '../common/rate-limit.decorator';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import type { StaffRequest } from '../rbac/staff-request';
import { ConsoleCommandDto } from './dto/console-command.dto';
import { PowerDto } from './dto/power.dto';
import { RconDto } from './dto/rcon.dto';
import { ServerService } from './server.service';

@Controller('server')
export class ServerController {
  constructor(private readonly server: ServerService) {}

  @Get('status')
  @RequirePermissions(Permissions.SERVER_VIEW)
  async status() {
    return this.server.getStatus();
  }

  /** Application API server list — no secrets in response. */
  @Get('list')
  @RequirePermissions(Permissions.SERVER_VIEW)
  async list() {
    return this.server.listServers();
  }

  /**
   * Console session probe for the SPA. Does NOT return Wings token/socket
   * (browser Origin is blocked by Wings). Requires console:read.
   */
  @Get('console/websocket')
  @RequirePermissions(Permissions.CONSOLE_READ)
  async consoleWebsocket(
    @Query('serverIdentifier') serverIdentifier?: string,
  ) {
    return this.server.getConsoleWebsocket(serverIdentifier);
  }

  /**
   * Live console SSE proxy: backend opens Wings WS with Panel Origin and
   * forwards console output. Cookie session required. Requires console:read.
   */
  @Sse('console/stream')
  @RequirePermissions(Permissions.CONSOLE_READ)
  consoleStream(
    @Req() req: StaffRequest,
    @Query('serverIdentifier') serverIdentifier?: string,
  ): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      const stop = this.server.streamConsole(serverIdentifier, (ev) => {
        subscriber.next({ data: ev });
        if (ev.kind === 'error') {
          subscriber.complete();
        }
      });
      const onClose = () => {
        stop();
        subscriber.complete();
      };
      req.on('close', onClose);
      return () => {
        req.off('close', onClose);
        stop();
      };
    });
  }

  /**
   * Send a console command via backend→Ptero websocket.
   * Accepts console:write OR server:command.
   */
  @Post('console/command')
  @HttpCode(200)
  @RateLimit({
    limit: 60,
    windowMs: 60_000,
    key: 'ip',
    message: 'Te veel console-commando’s. Probeer later opnieuw.',
  })
  async consoleCommand(@Req() req: StaffRequest, @Body() body: ConsoleCommandDto) {
    const perms = new Set(req.staffSession?.permissions ?? []);
    const canWrite =
      perms.has(Permissions.CONSOLE_WRITE) ||
      perms.has(Permissions.SERVER_COMMAND);
    if (!canWrite) {
      throw new ForbiddenException('Geen rechten voor deze actie');
    }
    return this.server.sendConsoleCommand(body.command, body.serverIdentifier);
  }

  @Get('rcon/safe-commands')
  @RequirePermissions(Permissions.CONSOLE_READ)
  safeCommands() {
    return { commands: this.server.listSafeCommands() };
  }

  @Post('power')
  @HttpCode(200)
  @RequirePermissions(Permissions.SERVER_POWER)
  async power(@Body() body: PowerDto) {
    return this.server.powerAction(
      body.action,
      body.confirm,
      body.serverIdentifier,
    );
  }

  @Post('rcon')
  @HttpCode(200)
  @RequirePermissions(Permissions.SERVER_COMMAND)
  @RateLimit({
    limit: 30,
    windowMs: 60_000,
    key: 'ip',
    message: 'Te veel RCON-verzoeken. Probeer later opnieuw.',
  })
  async rcon(@Body() body: RconDto) {
    return this.server.runRcon(body.command, body.confirm);
  }
}

import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { RateLimit } from '../common/rate-limit.decorator';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
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

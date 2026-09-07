import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, StaffSession } from '../auth/auth.service';
import { Permissions } from '../rbac/permissions';
import { PowerDto } from './dto/power.dto';
import { RconDto } from './dto/rcon.dto';
import { ServerService } from './server.service';

@Controller('server')
export class ServerController {
  constructor(
    private readonly server: ServerService,
    private readonly auth: AuthService,
  ) {}

  private requireSession(req: Request): StaffSession {
    const sessionId = req.cookies?.[this.auth.cookieName()] as
      | string
      | undefined;
    const session = this.auth.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Niet ingelogd');
    }
    return session;
  }

  private requirePermission(
    session: StaffSession,
    permission: (typeof Permissions)[keyof typeof Permissions],
  ): void {
    if (!session.permissions.includes(permission)) {
      throw new ForbiddenException('Geen rechten voor deze actie');
    }
  }

  @Get('status')
  async status(@Req() req: Request) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SERVER_VIEW);
    return this.server.getStatus();
  }

  /** Application API server list — no secrets in response. */
  @Get('list')
  async list(@Req() req: Request) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SERVER_VIEW);
    return this.server.listServers();
  }

  @Get('rcon/safe-commands')
  safeCommands(@Req() req: Request) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SERVER_VIEW);
    return { commands: this.server.listSafeCommands() };
  }

  @Post('power')
  @HttpCode(200)
  async power(@Req() req: Request, @Body() body: PowerDto) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SERVER_RESTART);
    return this.server.powerAction(
      body.action,
      body.confirm,
      body.serverIdentifier,
    );
  }

  @Post('rcon')
  @HttpCode(200)
  async rcon(@Req() req: Request, @Body() body: RconDto) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SERVER_COMMAND);
    return this.server.runRcon(body.command, body.confirm);
  }
}

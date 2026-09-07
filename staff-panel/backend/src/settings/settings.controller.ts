import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, StaffSession } from '../auth/auth.service';
import { Permissions } from '../rbac/permissions';
import { PatchModuleDto } from './dto/patch-module.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
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

  @Get('modules')
  listModules(@Req() req: Request) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SETTINGS_VIEW);
    return { modules: this.settings.listModules() };
  }

  @Patch('modules/:id')
  async patchModule(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: PatchModuleDto,
  ) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SETTINGS_MANAGE);
    return this.settings.patchModule(id, body.enabled);
  }
}

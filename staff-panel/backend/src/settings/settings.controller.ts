import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, StaffSession } from '../auth/auth.service';
import { Permissions } from '../rbac/permissions';
import { PteroCredentialsStore } from '../server/ptero-credentials.store';
import { PterodactylAdapter } from '../server/pterodactyl.adapter';
import { PatchModuleDto } from './dto/patch-module.dto';
import { PteroConfigDto } from './dto/ptero-config.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly auth: AuthService,
    private readonly pteroCreds: PteroCredentialsStore,
    private readonly ptero: PterodactylAdapter,
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

  /** Public Pterodactyl config — NEVER returns API key plaintext. */
  @Get('pterodactyl')
  getPterodactyl(@Req() req: Request) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SETTINGS_VIEW);
    return this.pteroCreds.toPublic();
  }

  /** Save panel URL / keys (write-only). Empty apiKey fields are ignored. */
  @Put('pterodactyl')
  putPterodactyl(@Req() req: Request, @Body() body: PteroConfigDto) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SETTINGS_MANAGE);
    return this.pteroCreds.save({
      baseUrl: body.baseUrl,
      apiKey: body.apiKey,
      clientApiKey: body.clientApiKey,
      defaultServerId: body.defaultServerId,
      clearApiKey: body.clearApiKey,
      clearClientApiKey: body.clearClientApiKey,
    });
  }

  @Post('pterodactyl/test')
  @HttpCode(200)
  async testPterodactyl(@Req() req: Request) {
    const session = this.requireSession(req);
    this.requirePermission(session, Permissions.SETTINGS_MANAGE);
    return this.ptero.testConnection();
  }
}

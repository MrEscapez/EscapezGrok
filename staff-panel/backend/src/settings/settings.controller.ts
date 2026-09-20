import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PteroCredentialsStore } from '../server/ptero-credentials.store';
import { PterodactylAdapter } from '../server/pterodactyl.adapter';
import { PatchModuleDto } from './dto/patch-module.dto';
import { TicketToolCredentialsStore } from '../tickets/ticket-tool-credentials.store';
import { TicketToolConfigDto } from '../tickets/dto/ticket-tool-config.dto';
import { PteroConfigDto } from './dto/ptero-config.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly pteroCreds: PteroCredentialsStore,
    private readonly ptero: PterodactylAdapter,
    private readonly ticketToolCreds: TicketToolCredentialsStore,
  ) {}

  @Get('modules')
  @RequirePermissions(Permissions.SETTINGS_VIEW)
  async listModules() {
    return { modules: await this.settings.listModules() };
  }

  @Patch('modules/:id')
  @RequirePermissions(Permissions.SETTINGS_MANAGE)
  async patchModule(@Param('id') id: string, @Body() body: PatchModuleDto) {
    return this.settings.patchModule(id, body.enabled);
  }

  /** Public Pterodactyl config — NEVER returns API key plaintext. */
  @Get('pterodactyl')
  @RequirePermissions(Permissions.SETTINGS_VIEW)
  getPterodactyl() {
    return this.pteroCreds.toPublic();
  }

  /** Save panel URL / keys (write-only). Empty apiKey fields are ignored. */
  @Put('pterodactyl')
  @RequirePermissions(Permissions.SETTINGS_MANAGE)
  putPterodactyl(@Body() body: PteroConfigDto) {
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
  @RequirePermissions(Permissions.SETTINGS_MANAGE)
  async testPterodactyl() {
    return this.ptero.testConnection();
  }

  /** Public Ticket Tool config — NEVER returns token/secret plaintext. */
  @Get('ticket-tool')
  @RequirePermissions(Permissions.SETTINGS_VIEW)
  getTicketTool() {
    return this.ticketToolCreds.toPublic();
  }

  /** Save API token / webhook secret (write-only). Empty fields are ignored. */
  @Put('ticket-tool')
  @RequirePermissions(Permissions.SETTINGS_MANAGE)
  putTicketTool(@Body() body: TicketToolConfigDto) {
    return this.ticketToolCreds.save({
      apiToken: body.apiToken,
      webhookSecret: body.webhookSecret,
      clearApiToken: body.clearApiToken,
      clearWebhookSecret: body.clearWebhookSecret,
    });
  }
}

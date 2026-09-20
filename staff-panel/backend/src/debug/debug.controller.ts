import { Controller, Get } from '@nestjs/common';
import { BridgeService } from '../bridge/bridge.service';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { PteroCredentialsStore } from '../server/ptero-credentials.store';
import { ServerService } from '../server/server.service';

/**
 * Admin-only debug endpoints — detailed Ptero/API diagnostics.
 * Protected with debug:view (seeded on admin only).
 */
@Controller('debug')
export class DebugController {
  constructor(
    private readonly server: ServerService,
    private readonly bridge: BridgeService,
    private readonly pteroCreds: PteroCredentialsStore,
  ) {}

  @Get('overview')
  @RequirePermissions(Permissions.DEBUG_VIEW)
  async overview() {
    const [status, list] = await Promise.all([
      this.server.getStatus(),
      this.server.listServers(),
    ]);
    const bridge = this.bridge.getStatus();
    const ptero = this.pteroCreds.toPublic();
    return {
      status,
      servers: list,
      bridge,
      pterodactyl: ptero,
      clientApiKeyConfigured: this.server.isClientApiKeyConfigured(),
    };
  }
}

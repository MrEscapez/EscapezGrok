import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';

@Controller('punishments')
export class PunishmentsController {
  @Get()
  @RequirePermissions(Permissions.PUNISHMENTS_VIEW)
  list(): {
    items: Array<{
      id: string;
      player: string;
      type: 'ban' | 'mute' | 'warn';
      reason: string;
      staff: string;
      until: string | null;
      status: string;
    }>;
  } {
    return { items: [] };
  }
}

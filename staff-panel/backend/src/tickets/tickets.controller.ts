import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';

@Controller('tickets')
export class TicketsController {
  @Get()
  @RequirePermissions(Permissions.TICKETS_VIEW)
  list(): {
    items: Array<{
      id: string;
      subject: string;
      player: string;
      status: string;
      createdAt: string;
    }>;
  } {
    return { items: [] };
  }
}

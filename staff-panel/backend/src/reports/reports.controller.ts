import { Controller, Get } from '@nestjs/common';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';

@Controller('reports')
export class ReportsController {
  @Get()
  @RequirePermissions(Permissions.REPORTS_VIEW)
  list(): {
    items: Array<{
      id: string;
      player: string;
      reason: string;
      status: string;
      createdAt: string;
    }>;
  } {
    return { items: [] };
  }
}

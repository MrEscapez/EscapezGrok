import { Controller, Get, Query } from '@nestjs/common';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';

@Controller('players')
export class PlayersController {
  @Get()
  @RequirePermissions(Permissions.PLAYERS_VIEW)
  list(
    @Query('q') q?: string,
  ): {
    items: Array<{
      id: string;
      username: string;
      uuid: string | null;
    }>;
    query: string;
  } {
    const query = (q ?? '').trim();
    void query;
    return { items: [], query };
  }
}

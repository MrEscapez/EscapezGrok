import { Controller, Get, Query } from '@nestjs/common';

/**
 * Thin stub for spelerzoeken — returns empty list until EscapezCore/Postgres is wired.
 */
@Controller('players')
export class PlayersController {
  @Get()
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
    // Stub: always empty until real player store exists
    void query;
    return { items: [], query };
  }
}

import { Controller, Get } from '@nestjs/common';

/**
 * Thin stub for supporttickets — empty until ticket store is wired.
 */
@Controller('tickets')
export class TicketsController {
  @Get()
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

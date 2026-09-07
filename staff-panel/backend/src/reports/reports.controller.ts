import { Controller, Get } from '@nestjs/common';

/**
 * Thin stub for reports list — empty until EscapezCore API is connected.
 */
@Controller('reports')
export class ReportsController {
  @Get()
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

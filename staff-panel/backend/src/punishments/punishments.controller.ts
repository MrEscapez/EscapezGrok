import { Controller, Get } from '@nestjs/common';

/**
 * Thin stub for straffen (bans/mutes/warns) — empty until LiteBans/EscapezCore.
 */
@Controller('punishments')
export class PunishmentsController {
  @Get()
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

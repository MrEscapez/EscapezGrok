import { Controller, Get } from '@nestjs/common';
import { Public } from '../rbac/public.decorator';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check(): { status: string; service: string; timestamp: string } {
    return {
      status: 'ok',
      service: 'escapezcraft-staff-panel-backend',
      timestamp: new Date().toISOString(),
    };
  }
}

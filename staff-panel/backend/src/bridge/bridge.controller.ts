import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AuthService } from '../auth/auth.service';
import { Public } from '../rbac/public.decorator';
import { SettingsService } from '../settings/settings.service';
import {
  hasStaffSession,
  hasValidBridgeApiKey,
} from './bridge-auth';
import { BridgeService } from './bridge.service';
import { BridgeEventDto } from './dto/event.dto';

@Controller('bridge')
@Public()
export class BridgeController {
  constructor(
    private readonly bridge: BridgeService,
    private readonly config: ConfigService,
    private readonly auth: AuthService,
    private readonly settings: SettingsService,
  ) {}

  /** EscapezCore → staff backend heartbeat (API key required). */
  @Post('heartbeat')
  @HttpCode(200)
  heartbeat(@Req() req: Request, @Body() body: Record<string, unknown>) {
    this.assertBridgeKey(req);
    const safe =
      body && typeof body === 'object' && !Array.isArray(body)
        ? body
        : {};
    const entry = this.bridge.recordHeartbeat(safe);
    return { ok: true, receivedAt: entry.receivedAt };
  }

  /** EscapezCore → event envelope (API key required). */
  @Post('events')
  @HttpCode(200)
  events(@Req() req: Request, @Body() body: BridgeEventDto) {
    this.assertBridgeKey(req);
    const event = this.bridge.pushEvent(
      body.type,
      body.payload,
      body.timestamp,
    );
    return { ok: true, id: event.id };
  }

  /**
   * Last heartbeat + buffer size.
   * Auth: staff cookie session OR X-Escapez-Api-Key.
   */
  @Get('status')
  status(@Req() req: Request) {
    if (
      !hasValidBridgeApiKey(req, this.config) &&
      !hasStaffSession(req, this.auth)
    ) {
      throw new UnauthorizedException(
        'Staff-sessie of X-Escapez-Api-Key vereist',
      );
    }
    return this.bridge.getStatus();
  }

  /**
   * Module on/off status for EscapezCore (FASE 10 bridge).
   * Auth: X-Escapez-Api-Key required.
   */
  @Get('modules')
  async modules(@Req() req: Request) {
    this.assertBridgeKey(req);
    return this.settings.listForBridge();
  }

  private assertBridgeKey(req: Request): void {
    if (!hasValidBridgeApiKey(req, this.config)) {
      throw new UnauthorizedException(
        'Ongeldige of ontbrekende X-Escapez-Api-Key',
      );
    }
  }
}

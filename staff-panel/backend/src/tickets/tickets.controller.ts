import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../rbac/public.decorator';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import { BridgeCloseDto } from './dto/bridge-close.dto';
import { BridgeMessageDto } from './dto/bridge-message.dto';
import { BridgeUpsertDto } from './dto/bridge-upsert.dto';
import { TicketsService } from './tickets.service';

@Controller('tickets')
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  @RequirePermissions(Permissions.TICKETS_VIEW)
  list() {
    return this.tickets.list();
  }

  /**
   * Discord bridge → create/update ticket from a Ticket Tool channel.
   * Auth: Bearer STAFF_PANEL_BRIDGE_SECRET or X-Staff-Bridge-Secret (not staff cookie).
   */
  @Post('bridge/upsert')
  @Public()
  @HttpCode(200)
  bridgeUpsert(
    @Body() body: BridgeUpsertDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-staff-bridge-secret') bridgeSecretHeader?: string,
  ) {
    this.tickets.assertBridgeAuth({ authorization, bridgeSecretHeader });
    return this.tickets.bridgeUpsert(body);
  }

  /**
   * Discord bridge → append a channel message to a ticket.
   */
  @Post('bridge/message')
  @Public()
  @HttpCode(200)
  bridgeMessage(
    @Body() body: BridgeMessageDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-staff-bridge-secret') bridgeSecretHeader?: string,
  ) {
    this.tickets.assertBridgeAuth({ authorization, bridgeSecretHeader });
    return this.tickets.bridgeMessage(body);
  }

  /**
   * Discord bridge → close ticket (channel deleted / archived).
   */
  @Post('bridge/close')
  @Public()
  @HttpCode(200)
  bridgeClose(
    @Body() body: BridgeCloseDto,
    @Headers('authorization') authorization?: string,
    @Headers('x-staff-bridge-secret') bridgeSecretHeader?: string,
  ) {
    this.tickets.assertBridgeAuth({ authorization, bridgeSecretHeader });
    return this.tickets.bridgeClose(body);
  }

  /**
   * Optional Ticket Tool Pro webhook (HMAC). Prefer Discord bridge for free plans.
   */
  @Post('webhook')
  @Public()
  @HttpCode(200)
  webhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-tickettool-signature') signature?: string,
    @Headers('x-tickettool-timestamp') timestamp?: string,
    @Headers('x-webhook-event') eventHeader?: string,
  ) {
    const rawBuf = req.rawBody;
    if (!rawBuf || rawBuf.length === 0) {
      throw new UnauthorizedException('Lege webhook-body');
    }
    const rawBody = Buffer.isBuffer(rawBuf)
      ? rawBuf.toString('utf8')
      : String(rawBuf);
    return this.tickets.handleWebhook({
      rawBody,
      signature,
      timestamp,
      eventHeader,
    });
  }

  /** Herlaad lokaal / optionele Pro sync — tickets:manage. */
  @Post('sync')
  @HttpCode(200)
  @RequirePermissions(Permissions.TICKETS_MANAGE)
  sync() {
    return this.tickets.syncFromApi();
  }

  @Get(':id')
  @RequirePermissions(Permissions.TICKETS_VIEW)
  getOne(@Param('id') id: string) {
    const detail = this.tickets.get(id);
    if (!detail) {
      throw new NotFoundException('Ticket niet gevonden');
    }
    return detail;
  }
}

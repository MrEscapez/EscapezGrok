import {
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
   * Ticket Tool → staff panel webhook.
   * Auth: HMAC-SHA256(secret, `${timestamp}.${rawBody}`) via
   * X-TicketTool-Signature + X-TicketTool-Timestamp.
   * Event type in X-Webhook-Event.
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

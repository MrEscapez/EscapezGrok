import { Module } from '@nestjs/common';
import { TicketToolCredentialsStore } from './ticket-tool-credentials.store';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsStore } from './tickets.store';

@Module({
  controllers: [TicketsController],
  providers: [TicketsService, TicketsStore, TicketToolCredentialsStore],
  exports: [TicketsService, TicketToolCredentialsStore],
})
export class TicketsModule {}

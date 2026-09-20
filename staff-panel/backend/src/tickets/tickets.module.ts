import { Module } from '@nestjs/common';
import { DiscordBridgeCredentialsStore } from './discord-bridge-credentials.store';
import { TicketToolCredentialsStore } from './ticket-tool-credentials.store';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { TicketsStore } from './tickets.store';

@Module({
  controllers: [TicketsController],
  providers: [
    TicketsService,
    TicketsStore,
    TicketToolCredentialsStore,
    DiscordBridgeCredentialsStore,
  ],
  exports: [
    TicketsService,
    TicketToolCredentialsStore,
    DiscordBridgeCredentialsStore,
  ],
})
export class TicketsModule {}

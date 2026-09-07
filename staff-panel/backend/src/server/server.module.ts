import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PteroCredentialsStore } from './ptero-credentials.store';
import { PterodactylAdapter } from './pterodactyl.adapter';
import { RconAdapter } from './rcon.adapter';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';

@Module({
  imports: [AuthModule],
  controllers: [ServerController],
  providers: [
    ServerService,
    PteroCredentialsStore,
    PterodactylAdapter,
    RconAdapter,
  ],
  exports: [PteroCredentialsStore, PterodactylAdapter, ServerService],
})
export class ServerModule {}

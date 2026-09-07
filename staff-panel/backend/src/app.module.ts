import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { PlayersModule } from './players/players.module';
import { ReportsModule } from './reports/reports.module';
import { BridgeModule } from './bridge/bridge.module';
import { RealtimeModule } from './realtime/realtime.module';
import { PunishmentsModule } from './punishments/punishments.module';
import { TicketsModule } from './tickets/tickets.module';
import { PlannerModule } from './planner/planner.module';
import { SettingsModule } from './settings/settings.module';
import { ServerModule } from './server/server.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    HealthModule,
    AuthModule,
    PlayersModule,
    ReportsModule,
    BridgeModule,
    RealtimeModule,
    PunishmentsModule,
    TicketsModule,
    PlannerModule,
    SettingsModule,
    ServerModule,
  ],
})
export class AppModule {}

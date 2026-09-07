import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
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
import { UsersModule } from './users/users.module';
import { RbacModule } from './rbac/rbac.module';
import { SessionAuthGuard } from './rbac/session-auth.guard';
import { PermissionsGuard } from './rbac/permissions.guard';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    RbacModule,
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
    UsersModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: SessionAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}

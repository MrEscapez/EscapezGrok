import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ServerModule } from '../server/server.module';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';

@Module({
  imports: [AuthModule, ServerModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}

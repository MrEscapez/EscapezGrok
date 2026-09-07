import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BridgeModule } from '../bridge/bridge.module';
import { RealtimeController } from './realtime.controller';

@Module({
  imports: [AuthModule, BridgeModule],
  controllers: [RealtimeController],
})
export class RealtimeModule {}

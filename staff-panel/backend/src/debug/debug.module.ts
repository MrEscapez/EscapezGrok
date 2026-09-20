import { Module } from '@nestjs/common';
import { BridgeModule } from '../bridge/bridge.module';
import { ServerModule } from '../server/server.module';
import { DebugController } from './debug.controller';

@Module({
  imports: [ServerModule, BridgeModule],
  controllers: [DebugController],
})
export class DebugModule {}

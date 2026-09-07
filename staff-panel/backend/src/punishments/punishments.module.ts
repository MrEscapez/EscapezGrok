import { Module } from '@nestjs/common';
import { PunishmentsController } from './punishments.controller';

@Module({
  controllers: [PunishmentsController],
})
export class PunishmentsModule {}

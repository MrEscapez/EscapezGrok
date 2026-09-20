import { Module } from '@nestjs/common';
import { StaffDocsController } from './staff-docs.controller';
import { StaffDocsService } from './staff-docs.service';

@Module({
  controllers: [StaffDocsController],
  providers: [StaffDocsService],
  exports: [StaffDocsService],
})
export class StaffDocsModule {}

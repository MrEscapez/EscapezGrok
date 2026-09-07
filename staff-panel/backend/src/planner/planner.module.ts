import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PlannerController } from './planner.controller';
import { PlannerService } from './planner.service';

@Module({
  imports: [AuthModule],
  controllers: [PlannerController],
  providers: [PlannerService],
})
export class PlannerModule {}

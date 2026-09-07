import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { Permissions } from '../rbac/permissions';
import { RequirePermissions } from '../rbac/require-permissions.decorator';
import type { StaffRequest } from '../rbac/staff-request';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateShiftsDto } from './dto/update-shifts.dto';
import { PlannerService } from './planner.service';

@Controller('planner')
export class PlannerController {
  constructor(private readonly planner: PlannerService) {}

  private username(req: StaffRequest): string {
    return req.staffSession?.username ?? 'unknown';
  }

  @Get('schedules')
  @RequirePermissions(Permissions.PLANNER_VIEW)
  listSchedules(@Query('weekStart') weekStart?: string) {
    const items = this.planner.listOrGetByWeek(weekStart);
    return { items };
  }

  @Get('schedules/:id')
  @RequirePermissions(Permissions.PLANNER_VIEW)
  getSchedule(@Param('id') id: string) {
    return this.planner.getById(id);
  }

  @Post('schedules')
  @HttpCode(200)
  @RequirePermissions(Permissions.PLANNER_MANAGE)
  createSchedule(@Req() req: StaffRequest, @Body() body: CreateScheduleDto) {
    return this.planner.createDraft(body.weekStart, this.username(req));
  }

  @Put('schedules/:id/shifts')
  @RequirePermissions(Permissions.PLANNER_MANAGE)
  updateShifts(
    @Req() req: StaffRequest,
    @Param('id') id: string,
    @Body() body: UpdateShiftsDto,
  ) {
    return this.planner.replaceShifts(
      id,
      body.version,
      body.shifts,
      this.username(req),
    );
  }

  @Post('schedules/:id/validate')
  @HttpCode(200)
  @RequirePermissions(Permissions.PLANNER_VIEW)
  validate(@Param('id') id: string) {
    return this.planner.validate(id);
  }

  @Post('schedules/:id/publish')
  @HttpCode(200)
  @RequirePermissions(Permissions.PLANNER_PUBLISH)
  publish(@Req() req: StaffRequest, @Param('id') id: string) {
    return this.planner.publish(id, this.username(req));
  }

  @Post('schedules/:id/draft')
  @HttpCode(200)
  @RequirePermissions(Permissions.PLANNER_MANAGE)
  revertDraft(@Req() req: StaffRequest, @Param('id') id: string) {
    return this.planner.revertToDraft(id, this.username(req));
  }
}

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
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService, StaffSession } from '../auth/auth.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateShiftsDto } from './dto/update-shifts.dto';
import { PlannerService } from './planner.service';

@Controller('planner')
export class PlannerController {
  constructor(
    private readonly planner: PlannerService,
    private readonly auth: AuthService,
  ) {}

  private requireSession(req: Request): StaffSession {
    const sessionId = req.cookies?.[this.auth.cookieName()] as
      | string
      | undefined;
    const session = this.auth.getSession(sessionId);
    if (!session) {
      throw new UnauthorizedException('Niet ingelogd');
    }
    return session;
  }

  @Get('schedules')
  listSchedules(
    @Req() req: Request,
    @Query('weekStart') weekStart?: string,
  ) {
    this.requireSession(req);
    const items = this.planner.listOrGetByWeek(weekStart);
    return { items };
  }

  @Get('schedules/:id')
  getSchedule(@Req() req: Request, @Param('id') id: string) {
    this.requireSession(req);
    return this.planner.getById(id);
  }

  @Post('schedules')
  @HttpCode(200)
  createSchedule(@Req() req: Request, @Body() body: CreateScheduleDto) {
    const session = this.requireSession(req);
    return this.planner.createDraft(body.weekStart, session.username);
  }

  @Put('schedules/:id/shifts')
  updateShifts(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() body: UpdateShiftsDto,
  ) {
    const session = this.requireSession(req);
    return this.planner.replaceShifts(
      id,
      body.version,
      body.shifts,
      session.username,
    );
  }

  @Post('schedules/:id/validate')
  @HttpCode(200)
  validate(@Req() req: Request, @Param('id') id: string) {
    this.requireSession(req);
    return this.planner.validate(id);
  }

  @Post('schedules/:id/publish')
  @HttpCode(200)
  publish(@Req() req: Request, @Param('id') id: string) {
    const session = this.requireSession(req);
    return this.planner.publish(id, session.username);
  }

  @Post('schedules/:id/draft')
  @HttpCode(200)
  revertDraft(@Req() req: Request, @Param('id') id: string) {
    const session = this.requireSession(req);
    return this.planner.revertToDraft(id, session.username);
  }
}

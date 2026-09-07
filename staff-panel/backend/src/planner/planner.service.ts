import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  PlannerShift,
  SHIFT_DEFAULTS,
  Schedule,
  ShiftType,
  ValidationResult,
} from './planner.types';
import { validateSchedule } from './planner.validators';

function mondayOf(d: Date): string {
  const copy = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = copy.getUTCDay(); // 0 Sun … 6 Sat
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy.toISOString().slice(0, 10);
}

function isMondayIso(iso: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1;
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function applyShiftDefaults(shift: PlannerShift): PlannerShift {
  const defaults = SHIFT_DEFAULTS[shift.type];
  if (!defaults) {
    return {
      ...shift,
      startTime: undefined,
      endTime: undefined,
    };
  }
  return {
    ...shift,
    startTime: shift.startTime ?? defaults.startTime,
    endTime: shift.endTime ?? defaults.endTime,
  };
}

const VALID_TYPES: ShiftType[] = ['EARLY', 'DAY', 'LATE', 'NIGHT', 'OFF'];

@Injectable()
export class PlannerService implements OnModuleInit {
  private readonly schedules = new Map<string, Schedule>();

  onModuleInit(): void {
    this.seedDemoWeek();
  }

  listOrGetByWeek(weekStart?: string): Schedule[] {
    if (weekStart) {
      if (!isMondayIso(weekStart)) {
        throw new BadRequestException(
          'weekStart moet een ISO-maandag zijn (YYYY-MM-DD)',
        );
      }
      const found = [...this.schedules.values()].filter(
        (s) => s.weekStart === weekStart,
      );
      return found;
    }
    return [...this.schedules.values()].sort((a, b) =>
      a.weekStart.localeCompare(b.weekStart),
    );
  }

  getById(id: string): Schedule {
    const s = this.schedules.get(id);
    if (!s) throw new NotFoundException('Rooster niet gevonden');
    return s;
  }

  createDraft(weekStart: string, by: string): Schedule {
    if (!isMondayIso(weekStart)) {
      throw new BadRequestException(
        'weekStart moet een ISO-maandag zijn (YYYY-MM-DD)',
      );
    }
    const existing = [...this.schedules.values()].find(
      (s) => s.weekStart === weekStart,
    );
    if (existing) return existing;

    const now = new Date().toISOString();
    const schedule: Schedule = {
      id: `sched_${randomUUID()}`,
      weekStart,
      status: 'DRAFT',
      version: 1,
      shifts: [],
      updatedAt: now,
      holidayExceptions: [],
      changelog: [
        {
          at: now,
          action: 'CREATE_DRAFT',
          by,
          detail: `Draft voor week ${weekStart}`,
        },
      ],
    };
    this.schedules.set(schedule.id, schedule);
    return schedule;
  }

  replaceShifts(
    id: string,
    version: number,
    shifts: Array<{
      id?: string;
      staffUserId: string;
      staffName: string;
      date: string;
      type: ShiftType;
      startTime?: string;
      endTime?: string;
    }>,
    by: string,
  ): Schedule {
    const schedule = this.getById(id);
    if (schedule.version !== version) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Version conflict — herlaad het rooster en probeer opnieuw',
        currentVersion: schedule.version,
      });
    }

    const weekEnd = addDays(schedule.weekStart, 6);
    const nextShifts: PlannerShift[] = shifts.map((raw) => {
      if (!VALID_TYPES.includes(raw.type)) {
        throw new BadRequestException(`Ongeldig shift-type: ${raw.type}`);
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) {
        throw new BadRequestException(`Ongeldige datum: ${raw.date}`);
      }
      if (raw.date < schedule.weekStart || raw.date > weekEnd) {
        throw new BadRequestException(
          `Shift-datum ${raw.date} valt buiten week ${schedule.weekStart}`,
        );
      }
      if (!raw.staffUserId?.trim() || !raw.staffName?.trim()) {
        throw new BadRequestException('staffUserId en staffName zijn verplicht');
      }
      return applyShiftDefaults({
        id: raw.id?.trim() || `shift_${randomUUID()}`,
        staffUserId: raw.staffUserId.trim(),
        staffName: raw.staffName.trim(),
        date: raw.date,
        type: raw.type,
        startTime: raw.startTime,
        endTime: raw.endTime,
      });
    });

    const now = new Date().toISOString();
    const updated: Schedule = {
      ...schedule,
      shifts: nextShifts,
      version: schedule.version + 1,
      updatedAt: now,
      changelog: [
        ...schedule.changelog,
        {
          at: now,
          action: 'UPDATE_SHIFTS',
          by,
          detail: `${nextShifts.length} shifts`,
        },
      ],
    };
    this.schedules.set(id, updated);
    return updated;
  }

  validate(id: string): { results: ValidationResult[] } {
    const schedule = this.getById(id);
    return { results: validateSchedule(schedule) };
  }

  publish(id: string, by: string): Schedule {
    const schedule = this.getById(id);
    const results = validateSchedule(schedule);
    const errors = results.filter((r) => r.level === 'ERROR');
    if (errors.length > 0) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Kan niet publiceren: validatie heeft ERROR-resultaten',
        results,
      });
    }

    const now = new Date().toISOString();
    const updated: Schedule = {
      ...schedule,
      status: 'PUBLISHED',
      version: schedule.version + 1,
      updatedAt: now,
      changelog: [
        ...schedule.changelog,
        {
          at: now,
          action: 'PUBLISH',
          by,
          detail: 'Rooster gepubliceerd',
        },
      ],
    };
    this.schedules.set(id, updated);
    return updated;
  }

  revertToDraft(id: string, by: string): Schedule {
    const schedule = this.getById(id);
    const now = new Date().toISOString();
    const updated: Schedule = {
      ...schedule,
      status: 'DRAFT',
      version: schedule.version + 1,
      updatedAt: now,
      changelog: [
        ...schedule.changelog,
        {
          at: now,
          action: 'REVERT_DRAFT',
          by,
          detail: 'Teruggezet naar draft (stub undo)',
        },
      ],
    };
    this.schedules.set(id, updated);
    return updated;
  }

  private seedDemoWeek(): void {
    const weekStart = mondayOf(new Date());
    const now = new Date().toISOString();
    const demoStaff = [
      { id: 'staff-alice', name: 'Alice' },
      { id: 'staff-bob', name: 'Bob' },
      { id: 'staff-cara', name: 'Cara' },
      { id: 'staff-dan', name: 'Dan' },
    ];

    const raw: Array<{
      staffUserId: string;
      staffName: string;
      date: string;
      type: ShiftType;
    }> = [
      {
        staffUserId: demoStaff[0].id,
        staffName: demoStaff[0].name,
        date: weekStart,
        type: 'EARLY',
      },
      {
        staffUserId: demoStaff[1].id,
        staffName: demoStaff[1].name,
        date: weekStart,
        type: 'EARLY',
      },
      {
        staffUserId: demoStaff[2].id,
        staffName: demoStaff[2].name,
        date: weekStart,
        type: 'DAY',
      },
      {
        staffUserId: demoStaff[3].id,
        staffName: demoStaff[3].name,
        date: weekStart,
        type: 'DAY',
      },
      {
        staffUserId: demoStaff[0].id,
        staffName: demoStaff[0].name,
        date: addDays(weekStart, 1),
        type: 'DAY',
      },
      {
        staffUserId: demoStaff[1].id,
        staffName: demoStaff[1].name,
        date: addDays(weekStart, 2),
        type: 'LATE',
      },
      {
        staffUserId: demoStaff[2].id,
        staffName: demoStaff[2].name,
        date: addDays(weekStart, 3),
        type: 'NIGHT',
      },
      {
        staffUserId: demoStaff[3].id,
        staffName: demoStaff[3].name,
        date: addDays(weekStart, 4),
        type: 'OFF',
      },
    ];

    const schedule: Schedule = {
      id: `sched_demo_${weekStart}`,
      weekStart,
      status: 'DRAFT',
      version: 1,
      shifts: raw.map((r) =>
        applyShiftDefaults({
          id: `shift_${randomUUID()}`,
          ...r,
        }),
      ),
      updatedAt: now,
      holidayExceptions: [],
      changelog: [
        {
          at: now,
          action: 'SEED',
          by: 'system',
          detail: 'Demo DRAFT-week met voorbeeldshifts',
        },
      ],
    };
    this.schedules.set(schedule.id, schedule);
  }
}

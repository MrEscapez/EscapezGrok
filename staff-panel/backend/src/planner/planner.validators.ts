import {
  BELGIUM_HOLIDAYS_2026,
  PlannerShift,
  REQUIRED_STAFFING,
  SHIFT_DEFAULTS,
  Schedule,
  ShiftType,
  ValidationResult,
} from './planner.types';

function parseHm(hm: string): number {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + (m || 0);
}

/** Resolve start/end minutes from shift type defaults or explicit times. */
function shiftWindow(shift: PlannerShift): {
  startMin: number;
  endMin: number;
  crossesMidnight: boolean;
} | null {
  if (shift.type === 'OFF') return null;
  const defaults = SHIFT_DEFAULTS[shift.type];
  const start = shift.startTime ?? defaults?.startTime;
  const end = shift.endTime ?? defaults?.endTime;
  if (!start || !end) return null;
  const startMin = parseHm(start);
  let endMin = parseHm(end);
  const crossesMidnight = endMin <= startMin;
  if (crossesMidnight) endMin += 24 * 60;
  return { startMin, endMin, crossesMidnight };
}

/** Absolute minute offset from epoch-like day index for rest calculation. */
function absoluteStart(dateIso: string, startMin: number): number {
  const day = Date.parse(`${dateIso}T00:00:00.000Z`) / 60_000;
  return day + startMin;
}

function absoluteEnd(
  dateIso: string,
  endMin: number,
  crossesMidnight: boolean,
): number {
  const day = Date.parse(`${dateIso}T00:00:00.000Z`) / 60_000;
  // endMin already includes +24h when crossesMidnight from shiftWindow
  void crossesMidnight;
  return day + endMin;
}

function isWeekend(dateIso: string): boolean {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

function addDays(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function runMinimumRestRule(schedule: Schedule): ValidationResult[] {
  const results: ValidationResult[] = [];
  const byStaff = new Map<string, PlannerShift[]>();
  for (const s of schedule.shifts) {
    if (s.type === 'OFF') continue;
    const list = byStaff.get(s.staffUserId) ?? [];
    list.push(s);
    byStaff.set(s.staffUserId, list);
  }

  for (const [staffId, shifts] of byStaff) {
    const timed = shifts
      .map((s) => {
        const w = shiftWindow(s);
        if (!w) return null;
        return {
          shift: s,
          startAbs: absoluteStart(s.date, w.startMin),
          endAbs: absoluteEnd(s.date, w.endMin, w.crossesMidnight),
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.startAbs - b.startAbs);

    for (let i = 0; i < timed.length - 1; i++) {
      const a = timed[i];
      const b = timed[i + 1];
      const restMin = b.startAbs - a.endAbs;
      if (restMin < 11 * 60) {
        const name = a.shift.staffName;
        results.push({
          rule: 'MinimumRestRule',
          level: 'ERROR',
          message: `${name} (${staffId}): minder dan 11u rust tussen ${a.shift.date} ${a.shift.type} en ${b.shift.date} ${b.shift.type} (${Math.floor(restMin / 60)}u${restMin % 60 ? ` ${restMin % 60}m` : ''}).`,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      rule: 'MinimumRestRule',
      level: 'OK',
      message: 'Minimale rust van 11u tussen opeenvolgende shifts OK.',
    });
  }
  return results;
}

export function runEarlyShiftRule(schedule: Schedule): ValidationResult[] {
  const results: ValidationResult[] = [];
  const earlyByStaff = new Map<string, string[]>();

  for (const s of schedule.shifts) {
    if (s.type !== 'EARLY') continue;
    const list = earlyByStaff.get(s.staffUserId) ?? [];
    list.push(s.date);
    earlyByStaff.set(s.staffUserId, list);
  }

  for (const [staffId, dates] of earlyByStaff) {
    const sorted = [...dates].sort();
    const byDay = new Map<string, number>();
    for (const d of sorted) {
      byDay.set(d, (byDay.get(d) ?? 0) + 1);
    }
    const name =
      schedule.shifts.find((s) => s.staffUserId === staffId)?.staffName ??
      staffId;

    for (const [day, count] of byDay) {
      if (count >= 2) {
        results.push({
          rule: 'EarlyShiftRule',
          level: 'ERROR',
          message: `${name}: dubbele EARLY op dezelfde dag (${day}) — geen dubbele vroege.`,
        });
      }
    }

    const uniqueDays = [...byDay.keys()].sort();
    for (let i = 0; i < uniqueDays.length - 1; i++) {
      if (addDays(uniqueDays[i], 1) === uniqueDays[i + 1]) {
        results.push({
          rule: 'EarlyShiftRule',
          level: 'ERROR',
          message: `${name}: twee EARLY op opeenvolgende dagen (${uniqueDays[i]} → ${uniqueDays[i + 1]}) — geen dubbele vroege.`,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      rule: 'EarlyShiftRule',
      level: 'OK',
      message: 'Geen dubbele vroege shifts (zelfde dag of opeenvolgend).',
    });
  }
  return results;
}

export function runRequiredStaffingRule(
  schedule: Schedule,
): ValidationResult[] {
  const results: ValidationResult[] = [];
  const dates = weekDates(schedule.weekStart);

  for (const date of dates) {
    const weekend = isWeekend(date);
    const targets = weekend
      ? REQUIRED_STAFFING.weekend
      : REQUIRED_STAFFING.weekday;
    const dayShifts = schedule.shifts.filter((s) => s.date === date);

    for (const type of ['EARLY', 'DAY'] as const) {
      const count = dayShifts.filter((s) => s.type === type).length;
      const need = targets[type];
      if (count < need) {
        results.push({
          rule: 'RequiredStaffingRule',
          level: 'WARNING',
          message: `${date}: ${count}/${need} ${type}-shifts (doel ${weekend ? 'weekend' : 'weekdag'}).`,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      rule: 'RequiredStaffingRule',
      level: 'OK',
      message: 'Bezetting haalt stub-doelen (2 EARLY + 2 DAY per dag).',
    });
  }
  return results;
}

export function runWeekendRule(schedule: Schedule): ValidationResult[] {
  const results: ValidationResult[] = [];
  const dates = weekDates(schedule.weekStart).filter(isWeekend);

  for (const date of dates) {
    const targets = REQUIRED_STAFFING.weekend;
    const dayShifts = schedule.shifts.filter((s) => s.date === date);
    for (const type of ['EARLY', 'DAY'] as const) {
      const count = dayShifts.filter((s) => s.type === type).length;
      if (count < targets[type]) {
        results.push({
          rule: 'WeekendRule',
          level: 'WARNING',
          message: `Weekend ${date}: onderbezet voor ${type} (${count}/${targets[type]}).`,
        });
      }
    }
  }

  if (results.length === 0) {
    results.push({
      rule: 'WeekendRule',
      level: 'OK',
      message: 'Weekendbezetting OK t.o.v. RequiredStaffingRule-doelen.',
    });
  }
  return results;
}

export function runHolidayRule(schedule: Schedule): ValidationResult[] {
  const results: ValidationResult[] = [];
  const exceptions = new Set(schedule.holidayExceptions ?? []);
  const holidays = new Set(BELGIUM_HOLIDAYS_2026);
  const workTypes: ShiftType[] = ['EARLY', 'DAY'];

  for (const s of schedule.shifts) {
    if (!workTypes.includes(s.type)) continue;
    if (!holidays.has(s.date)) continue;
    if (exceptions.has(s.date)) continue;
    results.push({
      rule: 'HolidayRule',
      level: 'WARNING',
      message: `${s.staffName}: ${s.type} op Belgische feestdag ${s.date} zonder uitzondering.`,
    });
  }

  // Also flag if any holiday falls in the week with EARLY/DAY scheduled without exception — covered above.
  // Escalate to ERROR only if multiple staff on same holiday without exception (stub severity bump).
  const byHoliday = new Map<string, number>();
  for (const r of results) {
    const m = r.message.match(/(\d{4}-\d{2}-\d{2})/);
    if (m) byHoliday.set(m[1], (byHoliday.get(m[1]) ?? 0) + 1);
  }
  for (const [day, count] of byHoliday) {
    if (count >= 3) {
      results.push({
        rule: 'HolidayRule',
        level: 'ERROR',
        message: `Feestdag ${day}: ${count} EARLY/DAY-shifts zonder uitzondering (te hoog).`,
      });
    }
  }

  if (results.length === 0) {
    results.push({
      rule: 'HolidayRule',
      level: 'OK',
      message: 'Geen problematische feestdag-shifts (BE 2026 stub-lijst).',
    });
  }
  return results;
}

export function runCoupleRule(_schedule: Schedule): ValidationResult[] {
  void _schedule;
  return [
    {
      rule: 'CoupleRule',
      level: 'OK',
      message: 'CoupleRule stub',
    },
  ];
}

export function validateSchedule(schedule: Schedule): ValidationResult[] {
  return [
    ...runMinimumRestRule(schedule),
    ...runEarlyShiftRule(schedule),
    ...runRequiredStaffingRule(schedule),
    ...runWeekendRule(schedule),
    ...runHolidayRule(schedule),
    ...runCoupleRule(schedule),
  ];
}

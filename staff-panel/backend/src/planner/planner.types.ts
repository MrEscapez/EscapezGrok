/** Shift types for EscapezCraft staff planner (FASE 14 stubs). */
export type ShiftType = 'EARLY' | 'DAY' | 'LATE' | 'NIGHT' | 'OFF';

export type ScheduleStatus = 'DRAFT' | 'PUBLISHED';

export type ValidationLevel = 'OK' | 'WARNING' | 'ERROR';

/** Default clock windows (24h, local/demo). LATE/NIGHT span midnight. */
export const SHIFT_DEFAULTS: Record<
  ShiftType,
  { startTime: string; endTime: string } | null
> = {
  EARLY: { startTime: '06:00', endTime: '14:00' },
  DAY: { startTime: '14:00', endTime: '22:00' },
  LATE: { startTime: '22:00', endTime: '06:00' },
  NIGHT: { startTime: '22:00', endTime: '06:00' },
  OFF: null,
};

/** Target staffing: 2 EARLY + 2 DAY per weekday (stub). */
export const REQUIRED_STAFFING = {
  weekday: { EARLY: 2, DAY: 2 },
  weekend: { EARLY: 2, DAY: 2 },
} as const;

/** Hardcoded Belgium public holidays (sample 2026) for HolidayRule stub. */
export const BELGIUM_HOLIDAYS_2026: string[] = [
  '2026-01-01', // Nieuwjaar
  '2026-04-06', // Paasmaandag
  '2026-05-01', // Dag van de Arbeid
  '2026-05-14', // Hemelvaart
  '2026-05-25', // Pinkstermaandag
  '2026-07-21', // Nationale feestdag
  '2026-08-15', // Maria-Hemelvaart
  '2026-11-01', // Allerheiligen
  '2026-11-11', // Wapenstilstand
  '2026-12-25', // Kerstmis
];

export interface PlannerShift {
  id: string;
  staffUserId: string;
  staffName: string;
  date: string; // ISO date YYYY-MM-DD
  type: ShiftType;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
}

export interface ChangelogEntry {
  at: string;
  action: string;
  by: string;
  detail?: string;
}

export interface Schedule {
  id: string;
  weekStart: string; // ISO Monday YYYY-MM-DD
  status: ScheduleStatus;
  version: number;
  shifts: PlannerShift[];
  updatedAt: string;
  changelog: ChangelogEntry[];
  /** Manual holiday exceptions (ISO dates) — empty by default. */
  holidayExceptions: string[];
}

export interface ValidationResult {
  rule: string;
  level: ValidationLevel;
  message: string;
}

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  createPlannerSchedule,
  fetchPlannerSchedules,
  publishPlannerSchedule,
  revertPlannerToDraft,
  updatePlannerShifts,
  validatePlannerSchedule,
  type PlannerSchedule,
  type PlannerShift,
  type ShiftType,
  type ValidationResult,
} from '../lib/api';

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const SHIFT_LABELS: Record<ShiftType, string> = {
  EARLY: 'Vroeg',
  DAY: 'Dag',
  LATE: 'Laat',
  NIGHT: 'Nacht',
  OFF: 'Vrij',
};

function mondayOf(d: Date): string {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = copy.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart: string): string {
  const end = addDays(weekStart, 6);
  try {
    const fmt = new Intl.DateTimeFormat('nl-BE', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    });
    return `${fmt.format(new Date(`${weekStart}T12:00:00.000Z`))} – ${fmt.format(new Date(`${end}T12:00:00.000Z`))}`;
  } catch {
    return `${weekStart} – ${end}`;
  }
}

function formatDay(iso: string): string {
  try {
    return new Intl.DateTimeFormat('nl-BE', {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(`${iso}T12:00:00.000Z`));
  } catch {
    return iso.slice(5);
  }
}

export function PlannerPage() {
  const queryClient = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [localShifts, setLocalShifts] = useState<PlannerShift[]>([]);
  const [validation, setValidation] = useState<ValidationResult[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(null);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);

  const schedulesQuery = useQuery({
    queryKey: ['planner', 'schedules', weekStart],
    queryFn: () => fetchPlannerSchedules(weekStart),
    retry: false,
  });

  const schedule: PlannerSchedule | undefined = schedulesQuery.data?.items?.[0];

  const ensureMutation = useMutation({
    mutationFn: () => createPlannerSchedule(weekStart),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ['planner', 'schedules', weekStart],
      });
    },
  });

  useEffect(() => {
    if (schedulesQuery.isSuccess && !schedule && !ensureMutation.isPending) {
      ensureMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schedulesQuery.isSuccess, schedule?.id, weekStart]);

  useEffect(() => {
    if (schedule) {
      setLocalShifts(schedule.shifts);
      setValidation(null);
      setActionError(null);
      setSelectedShiftId(null);
    } else {
      setLocalShifts([]);
    }
  }, [schedule?.id, schedule?.version, schedule?.updatedAt]);

  const staffRows = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of localShifts) {
      map.set(s.staffUserId, s.staffName);
    }
    if (map.size === 0) {
      [
        ['staff-alice', 'Alice'],
        ['staff-bob', 'Bob'],
        ['staff-cara', 'Cara'],
        ['staff-dan', 'Dan'],
      ].forEach(([id, name]) => map.set(id, name));
    }
    return [...map.entries()].map(([id, name]) => ({ id, name }));
  }, [localShifts]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const saveMutation = useMutation({
    mutationFn: (shifts: PlannerShift[]) => {
      if (!schedule) throw new Error('Geen rooster');
      return updatePlannerShifts(schedule.id, schedule.version, shifts);
    },
    onSuccess: (updated) => {
      setActionError(null);
      queryClient.setQueryData(['planner', 'schedules', weekStart], {
        items: [updated],
      });
      setLocalShifts(updated.shifts);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : 'Opslaan mislukt',
      );
      void queryClient.invalidateQueries({
        queryKey: ['planner', 'schedules', weekStart],
      });
    },
  });

  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!schedule) throw new Error('Geen rooster');
      if (JSON.stringify(localShifts) !== JSON.stringify(schedule.shifts)) {
        const updated = await updatePlannerShifts(
          schedule.id,
          schedule.version,
          localShifts,
        );
        queryClient.setQueryData(['planner', 'schedules', weekStart], {
          items: [updated],
        });
        setLocalShifts(updated.shifts);
        return validatePlannerSchedule(updated.id);
      }
      return validatePlannerSchedule(schedule.id);
    },
    onSuccess: (res) => {
      setActionError(null);
      setValidation(res.results);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : 'Valideren mislukt',
      );
    },
  });

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!schedule) throw new Error('Geen rooster');
      if (JSON.stringify(localShifts) !== JSON.stringify(schedule.shifts)) {
        const updated = await updatePlannerShifts(
          schedule.id,
          schedule.version,
          localShifts,
        );
        queryClient.setQueryData(['planner', 'schedules', weekStart], {
          items: [updated],
        });
        return publishPlannerSchedule(updated.id);
      }
      return publishPlannerSchedule(schedule.id);
    },
    onSuccess: (updated) => {
      setActionError(null);
      queryClient.setQueryData(['planner', 'schedules', weekStart], {
        items: [updated],
      });
      setLocalShifts(updated.shifts);
      void validatePlannerSchedule(updated.id).then((r) =>
        setValidation(r.results),
      );
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        setActionError(err.message);
      } else {
        setActionError('Publiceren mislukt');
      }
    },
  });

  const draftMutation = useMutation({
    mutationFn: () => {
      if (!schedule) throw new Error('Geen rooster');
      return revertPlannerToDraft(schedule.id);
    },
    onSuccess: (updated) => {
      setActionError(null);
      queryClient.setQueryData(['planner', 'schedules', weekStart], {
        items: [updated],
      });
      setLocalShifts(updated.shifts);
    },
    onError: (err) => {
      setActionError(
        err instanceof ApiError ? err.message : 'Terug naar draft mislukt',
      );
    },
  });

  function moveShiftToDay(shiftId: string, newDate: string) {
    const next = localShifts.map((s) =>
      s.id === shiftId ? { ...s, date: newDate } : s,
    );
    setLocalShifts(next);
    setSelectedShiftId(null);
    saveMutation.mutate(next);
  }

  function onDragStart(e: DragEvent, shiftId: string) {
    e.dataTransfer.setData('text/shift-id', shiftId);
    e.dataTransfer.effectAllowed = 'move';
    setSelectedShiftId(shiftId);
  }

  function onDropDay(e: DragEvent, day: string) {
    e.preventDefault();
    setDragOverDay(null);
    const id =
      e.dataTransfer.getData('text/shift-id') || selectedShiftId || '';
    if (!id) return;
    moveShiftToDay(id, day);
  }

  const busy =
    saveMutation.isPending ||
    validateMutation.isPending ||
    publishMutation.isPending ||
    draftMutation.isPending;

  return (
    <section className="page">
      <header className="page__header">
        <h1 className="page__title">Planner</h1>
        <p className="page__desc">
          Weekrooster (FASE 14 stubs) — sleep shift-chips tussen dagen of klik
          om te verplaatsen.
        </p>
      </header>

      <div className="page__card planner">
        <div className="planner__toolbar">
          <div className="planner__week-nav">
            <button
              type="button"
              className="planner__nav-btn"
              onClick={() => setWeekStart(addDays(weekStart, -7))}
              aria-label="Vorige week"
            >
              ← Vorige
            </button>
            <div className="planner__week-label">
              <strong>{formatWeekLabel(weekStart)}</strong>
              <span className="mono">{weekStart}</span>
            </div>
            <button
              type="button"
              className="planner__nav-btn"
              onClick={() => setWeekStart(addDays(weekStart, 7))}
              aria-label="Volgende week"
            >
              Volgende →
            </button>
            <button
              type="button"
              className="planner__nav-btn planner__nav-btn--ghost"
              onClick={() => setWeekStart(mondayOf(new Date()))}
            >
              Deze week
            </button>
          </div>

          <div className="planner__meta">
            {schedule ? (
              <>
                <span
                  className={`badge badge--${schedule.status === 'PUBLISHED' ? 'gesloten' : 'in_behandeling'}`}
                >
                  {schedule.status === 'PUBLISHED' ? 'GEPUBLICEERD' : 'CONCEPT'}
                </span>
                <span className="planner__version">
                  v{schedule.version}
                </span>
              </>
            ) : (
              <span className="status-pill status-pill--loading">Laden…</span>
            )}
          </div>
        </div>

        <div className="planner__actions">
          <button
            type="button"
            className="planner__btn"
            disabled={!schedule || busy}
            onClick={() => validateMutation.mutate()}
          >
            Valideren
          </button>
          <button
            type="button"
            className="planner__btn planner__btn--primary"
            disabled={!schedule || busy || schedule.status === 'PUBLISHED'}
            onClick={() => publishMutation.mutate()}
          >
            Publiceren
          </button>
          <button
            type="button"
            className="planner__btn planner__btn--ghost"
            disabled={!schedule || busy || schedule.status === 'DRAFT'}
            onClick={() => draftMutation.mutate()}
          >
            Terug naar draft
          </button>
        </div>

        {actionError ? (
          <div className="empty-state empty-state--warn" role="alert">
            <p>{actionError}</p>
          </div>
        ) : null}

        {schedulesQuery.isError ? (
          <div className="empty-state empty-state--warn">
            <p>
              {schedulesQuery.error instanceof ApiError
                ? schedulesQuery.error.message
                : 'Kan planner niet laden.'}
            </p>
          </div>
        ) : null}

        {selectedShiftId ? (
          <p className="planner__hint" role="status">
            Shift geselecteerd — klik op een dagcel om te verplaatsen, of sleep
            de chip.
          </p>
        ) : (
          <p className="planner__hint">
            Sleep een chip naar een andere dag, of klik chip → klik cel.
          </p>
        )}

        <div className="planner-grid-wrap">
          <table className="planner-grid">
            <thead>
              <tr>
                <th>Staff</th>
                {days.map((day, i) => (
                  <th key={day}>
                    <div>{DAY_LABELS[i]}</div>
                    <div className="planner-grid__day-sub">{formatDay(day)}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {staffRows.map((staff) => (
                <tr key={staff.id}>
                  <th scope="row">{staff.name}</th>
                  {days.map((day) => {
                    const cellShifts = localShifts.filter(
                      (s) => s.staffUserId === staff.id && s.date === day,
                    );
                    const isDropTarget = dragOverDay === `${staff.id}:${day}`;
                    return (
                      <td
                        key={day}
                        className={`planner-grid__cell${isDropTarget ? ' planner-grid__cell--drop' : ''}${selectedShiftId ? ' planner-grid__cell--assignable' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverDay(`${staff.id}:${day}`);
                        }}
                        onDragLeave={() => setDragOverDay(null)}
                        onDrop={(e) => onDropDay(e, day)}
                        onClick={() => {
                          if (selectedShiftId) {
                            moveShiftToDay(selectedShiftId, day);
                          }
                        }}
                      >
                        <div className="planner-grid__chips">
                          {cellShifts.map((shift) => (
                            <button
                              key={shift.id}
                              type="button"
                              draggable
                              className={`shift-chip shift-chip--${shift.type}${selectedShiftId === shift.id ? ' shift-chip--selected' : ''}`}
                              title={`${shift.staffName} · ${SHIFT_LABELS[shift.type]}${shift.startTime ? ` ${shift.startTime}–${shift.endTime}` : ''}`}
                              onDragStart={(e) => onDragStart(e, shift.id)}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedShiftId((prev) =>
                                  prev === shift.id ? null : shift.id,
                                );
                              }}
                            >
                              <span className="shift-chip__type">
                                {SHIFT_LABELS[shift.type]}
                              </span>
                              {shift.type !== 'OFF' && shift.startTime ? (
                                <span className="shift-chip__time">
                                  {shift.startTime}
                                </span>
                              ) : null}
                            </button>
                          ))}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {validation ? (
          <div className="planner-validation">
            <h2 className="planner-validation__title">Validatieresultaten</h2>
            <ul className="planner-validation__list">
              {validation.map((r, idx) => (
                <li
                  key={`${r.rule}-${idx}`}
                  className={`planner-validation__item planner-validation__item--${r.level.toLowerCase()}`}
                >
                  <span className="planner-validation__level">{r.level}</span>
                  <span className="planner-validation__rule">{r.rule}</span>
                  <span className="planner-validation__msg">{r.message}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

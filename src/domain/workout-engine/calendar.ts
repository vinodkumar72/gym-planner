import { addDays, localDate, localDateOfIso } from './dates';
import type { ActiveRoutine, Recommendation, ScheduleEntry, SessionSummary, WorkoutOption } from './types';

function option(
  routine: ActiveRoutine,
  entry: ScheduleEntry,
  role: 'scheduled' | 'missed',
  scheduledFor: string,
): WorkoutOption | null {
  const t = routine.templates.find((x) => x.id === entry.templateId);
  if (!t) return null;
  return {
    templateId: t.id,
    templateName: t.name,
    routineId: routine.id,
    position: t.position,
    source: 'calendar',
    role,
    scheduledFor,
    intensity: 'normal',
  };
}

/**
 * Calendar mode: today's weekday decides the workout. If a scheduled workout within the lookback window
 * has no completed session on or after its day, we return a choice so the user decides. Never silent.
 */
export function calendarNext(
  routine: ActiveRoutine,
  recent: SessionSummary[],
  now: Date,
  lookbackDays: number,
): Recommendation {
  const today = localDate(now);
  const dow = now.getDay();
  const activatedDate = routine.activatedAt ? localDateOfIso(routine.activatedAt) : null;
  const completed = recent.filter((s) => s.status === 'completed' && s.routineId === routine.id);

  const todayEntry = routine.schedule.find((e) => e.dayOfWeek === dow);
  const scheduledToday = todayEntry ? option(routine, todayEntry, 'scheduled', today) : null;

  const doneToday =
    scheduledToday !== null &&
    completed.some((s) => s.templateId === scheduledToday.templateId && localDateOfIso(s.startedAt) === today);

  let missed: WorkoutOption | null = null;
  for (let d = 1; d <= lookbackDays; d += 1) {
    const date = addDays(now, -d);
    const day = localDate(date);
    if (activatedDate && day < activatedDate) break;
    const entry = routine.schedule.find((e) => e.dayOfWeek === date.getDay());
    if (!entry) continue;
    const satisfied = completed.some(
      (s) => s.templateId === entry.templateId && localDateOfIso(s.startedAt) >= day,
    );
    if (!satisfied) {
      missed = option(routine, entry, 'missed', day);
      if (missed) break;
    }
  }

  if (missed && scheduledToday && missed.templateId === scheduledToday.templateId) {
    missed = null;
  }

  if (scheduledToday && doneToday) {
    return {
      kind: 'rest_day',
      source: 'completed_today',
      override: null,
      reason: `You already completed ${scheduledToday.templateName} today. Nice work.`,
    };
  }
  if (scheduledToday && missed) {
    return {
      kind: 'choice',
      missed,
      scheduled: scheduledToday,
      reason: `${missed.templateName} was scheduled for ${missed.scheduledFor} but wasn't logged. Catch up or continue with today's ${scheduledToday.templateName}?`,
    };
  }
  if (scheduledToday) {
    return { kind: 'workout', option: scheduledToday, reason: `${scheduledToday.templateName} is scheduled for today.` };
  }
  if (missed) {
    return {
      kind: 'choice',
      missed,
      scheduled: null,
      reason: `${missed.templateName} was scheduled for ${missed.scheduledFor} but wasn't logged. Do it today, or rest.`,
    };
  }
  return {
    kind: 'rest_day',
    source: 'calendar',
    override: null,
    reason: 'Nothing scheduled today. Rest and recover.',
  };
}

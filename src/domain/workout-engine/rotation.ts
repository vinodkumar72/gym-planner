import type { ActiveRoutine, Recommendation, SessionSummary, TemplateRef, WorkoutOption } from './types';

function option(routine: ActiveRoutine, t: TemplateRef): WorkoutOption {
  return {
    templateId: t.id,
    templateName: t.name,
    routineId: routine.id,
    position: t.position,
    source: 'rotation',
    role: 'next',
    scheduledFor: null,
    intensity: 'normal',
  };
}

/**
 * Rotation mode: the next workout is simply the one after the last *completed* workout.
 * Dates are never consulted, so a missed day never skips a workout.
 */
export function rotationNext(routine: ActiveRoutine, last: SessionSummary | null): Recommendation {
  const templates = [...routine.templates].sort((a, b) => a.position - b.position);
  const first = templates[0];
  if (!first) {
    return { kind: 'no_routine', reason: 'Your routine has no workouts yet. Add one to get started.' };
  }
  if (!last) {
    return { kind: 'workout', option: option(routine, first), reason: `First workout of ${routine.name}.` };
  }
  if (last.routineId !== routine.id) {
    return {
      kind: 'workout',
      option: option(routine, first),
      reason: `You switched to ${routine.name}. Starting from the top.`,
    };
  }
  const idx = templates.findIndex((t) => t.id === last.templateId);
  if (idx === -1) {
    return {
      kind: 'workout',
      option: option(routine, first),
      reason: `Your last workout (${last.templateName}) is no longer in this routine. Starting from the top.`,
    };
  }
  const next = templates[(idx + 1) % templates.length] ?? first;
  return {
    kind: 'workout',
    option: option(routine, next),
    reason: `Next after ${last.templateName}.`,
  };
}

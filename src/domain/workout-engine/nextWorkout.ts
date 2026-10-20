import type { Readiness } from '../models/types';
import { calendarNext } from './calendar';
import { rotationNext } from './rotation';
import type { NextWorkoutInput, Recommendation, TrainableRecommendation, WorkoutOption } from './types';

const DEFAULT_LOOKBACK_DAYS = 3;

function reduced(o: WorkoutOption): WorkoutOption {
  return { ...o, intensity: 'reduced' };
}

function applyReadiness(base: Recommendation, readiness: Readiness | null): Recommendation {
  if (readiness === null || readiness === 'ready') return base;
  if (readiness === 'tired' || readiness === 'sore') {
    const note = ` Reduced intensity suggested: you said you're feeling ${readiness}.`;
    if (base.kind === 'workout') {
      return { ...base, option: reduced(base.option), reason: base.reason + note };
    }
    if (base.kind === 'choice') {
      return {
        ...base,
        missed: reduced(base.missed),
        scheduled: base.scheduled ? reduced(base.scheduled) : null,
        reason: base.reason + note,
      };
    }
    return base;
  }
  // readiness === 'rest'
  if (base.kind === 'workout' || base.kind === 'choice') {
    const override: TrainableRecommendation = base;
    return {
      kind: 'rest_day',
      source: 'readiness',
      override,
      reason: 'You marked today as a rest day. Recovery is part of training. You can still train if you change your mind.',
    };
  }
  return base;
}

/**
 * Deterministic "what should I train today" decision.
 * Priority: resume in-progress > no routine > readiness rest wrapper > rotation/calendar result.
 */
export function nextWorkout(input: NextWorkoutInput): Recommendation {
  if (input.inProgressSession) {
    const s = input.inProgressSession;
    return {
      kind: 'resume',
      sessionId: s.id,
      templateId: s.templateId,
      templateName: s.templateName,
      startedAt: s.startedAt,
      reason: `You have an unfinished ${s.templateName} workout.`,
    };
  }
  const routine = input.routine;
  if (!routine || routine.templates.length === 0) {
    return { kind: 'no_routine', reason: 'Pick or create a routine to get a workout recommendation.' };
  }
  const base =
    routine.rotationType === 'calendar'
      ? calendarNext(
          routine,
          input.recentCompletedSessions,
          input.now,
          input.missedLookbackDays ?? DEFAULT_LOOKBACK_DAYS,
        )
      : rotationNext(routine, input.lastCompletedSession);
  return applyReadiness(base, input.readiness);
}

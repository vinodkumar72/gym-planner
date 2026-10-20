import type { Db } from '@/db/types';
import * as routineRepo from '@/db/repositories/routineRepo';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { getPreferences } from '@/db/repositories/preferencesRepo';
import { exerciseKind, type Readiness, type WeightUnit } from '@/domain/models/types';
import { computeProgression, type PerformedExercise, type ProgressionResult, type ProgressionTarget } from '@/domain/progression';
import { addDays, nextWorkout, type ActiveRoutine, type Recommendation, type SessionSummary } from '@/domain/workout-engine';
import type { ExerciseRow, ExerciseSetRow, WorkoutSessionRow } from '@/db/schema';

export const MISSED_LOOKBACK_DAYS = 3;

function toSummary(s: WorkoutSessionRow): SessionSummary {
  return {
    id: s.id,
    routineId: s.routineId,
    templateId: s.templateId,
    templateName: s.templateNameSnapshot,
    status: s.status as SessionSummary['status'],
    startedAt: s.startedAt,
    completedAt: s.completedAt,
  };
}

export async function loadActiveRoutineForEngine(db: Db): Promise<ActiveRoutine | null> {
  const routine = await routineRepo.getActiveRoutine(db);
  if (!routine) return null;
  const templates = await routineRepo.getTemplatesForRoutine(db, routine.id);
  const schedule = await routineRepo.getScheduleForRoutine(db, routine.id);
  return {
    id: routine.id,
    name: routine.name,
    rotationType: routine.rotationType === 'calendar' ? 'calendar' : 'rotation',
    activatedAt: routine.activatedAt,
    templates: templates.map((t) => ({ id: t.id, name: t.name, position: t.position })),
    schedule: schedule.map((s) => ({ dayOfWeek: s.dayOfWeek, templateId: s.templateId })),
  };
}

/** Builds the engine input from the database and returns today's recommendation. */
export async function getTodayRecommendation(
  db: Db,
  readiness: Readiness | null,
  now: Date = new Date(),
): Promise<Recommendation> {
  const [routine, inProgress, last] = await Promise.all([
    loadActiveRoutineForEngine(db),
    sessionRepo.findInProgressSessions(db),
    sessionRepo.getLastCompletedSession(db),
  ]);
  const since = addDays(now, -(MISSED_LOOKBACK_DAYS + 1)).toISOString();
  const recent = await sessionRepo.listCompletedSessionsSince(db, since);
  return nextWorkout({
    routine,
    inProgressSession: inProgress[0] ? toSummary(inProgress[0]) : null,
    lastCompletedSession: last ? toSummary(last) : null,
    recentCompletedSessions: recent.map(toSummary),
    readiness,
    now,
    missedLookbackDays: MISSED_LOOKBACK_DAYS,
  });
}

export function setsToPerformed(sets: ExerciseSetRow[]) {
  return sets.map((s) => ({
    setType: (s.setType === 'warmup' ? 'warmup' : 'working') as 'warmup' | 'working',
    completed: s.completed === 1,
    targetReps: s.targetReps,
    actualReps: s.actualReps,
    weight: s.weight,
    weightUnit: (s.weightUnit as WeightUnit | null) ?? null,
    durationSeconds: s.durationSeconds,
    distance: s.distance,
    rpe: s.rpe,
    rir: s.rir,
  }));
}

export interface ExerciseTargetLike {
  targetSets: number;
  minReps: number;
  maxReps: number;
  progressionIncrement: number;
  incrementUnit: string;
  targetDurationSeconds: number | null;
  targetDistance: number | null;
}

export function toTarget(t: ExerciseTargetLike): ProgressionTarget {
  return {
    targetSets: t.targetSets,
    minReps: t.minReps,
    maxReps: t.maxReps,
    progressionIncrement: t.progressionIncrement,
    incrementUnit: t.incrementUnit === 'kg' ? 'kg' : 'lb',
    targetDurationSeconds: t.targetDurationSeconds,
    targetDistance: t.targetDistance,
  };
}

export interface ExerciseSuggestion {
  result: ProgressionResult;
  history: PerformedExercise[];
  lastPerformance: sessionRepo.ExercisePerformance | null;
}

/**
 * Progression suggestion for one exercise using the last two completed performances.
 * `history` may be supplied (e.g. including the just-finished session) to avoid a second query.
 */
export async function getExerciseSuggestion(
  db: Db,
  exercise: ExerciseRow,
  target: ExerciseTargetLike,
  readiness: Readiness | null,
  opts: { excludeSessionId?: string; prepend?: PerformedExercise[]; displayUnit?: WeightUnit } = {},
): Promise<ExerciseSuggestion> {
  const prefs = await getPreferences(db);
  const displayUnit = opts.displayUnit ?? ((prefs.weightUnit === 'kg' ? 'kg' : 'lb') as WeightUnit);
  const perf = await sessionRepo.getExerciseHistory(db, exercise.id, 2, opts.excludeSessionId);
  const history: PerformedExercise[] = [
    ...(opts.prepend ?? []),
    ...perf.map((p) => ({ sessionId: p.sessionId, performedAt: p.completedAt ?? p.startedAt, sets: setsToPerformed(p.sets) })),
  ].slice(0, 2);
  const result = computeProgression({
    exercise: {
      id: exercise.id,
      kind: exerciseKind(exercise.exerciseType, exercise.isBodyweight),
      minLoad: exercise.minLoad,
      minLoadUnit: (exercise.minLoadUnit as WeightUnit | null) ?? null,
    },
    target: toTarget(target),
    displayUnit,
    readiness,
    history,
  });
  return { result, history, lastPerformance: perf[0] ?? null };
}

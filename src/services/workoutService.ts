import type { Db } from '@/db/types';
import * as routineRepo from '@/db/repositories/routineRepo';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { getExercise } from '@/db/repositories/exerciseRepo';
import { getPreferences } from '@/db/repositories/preferencesRepo';
import type { ExerciseRow, NewExerciseSetRow, NewRecommendationHistoryRow } from '@/db/schema';
import { exerciseKind, type Readiness, type WeightUnit } from '@/domain/models/types';
import { localDate } from '@/domain/workout-engine';
import { convertWeight, roundTo } from '@/utils/units';
import { getExerciseSuggestion, setsToPerformed, toTarget, type ExerciseTargetLike } from './recommendationService';

export interface StartWorkoutOptions {
  templateId: string;
  readiness: Readiness | null;
  now?: Date;
  idFactory: () => string;
}

interface PlannedSet {
  setNumber: number;
  targetReps: number | null;
  weight: number | null;
  weightUnit: WeightUnit | null;
  durationSeconds: number | null;
  distance: number | null;
}

/** Decide the prefilled values for each planned set from last performance + progression suggestion. */
export function planSets(
  exercise: ExerciseRow,
  target: ExerciseTargetLike,
  suggestion: Awaited<ReturnType<typeof getExerciseSuggestion>>,
  displayUnit: WeightUnit,
): PlannedSet[] {
  const kind = exerciseKind(exercise.exerciseType, exercise.isBodyweight);
  const last = suggestion.lastPerformance;
  const lastWorking = last ? last.sets.filter((s) => s.setType === 'working' && s.completed === 1) : [];
  const presc = suggestion.result.prescription;
  const sets: PlannedSet[] = [];
  for (let i = 0; i < Math.max(1, target.targetSets); i += 1) {
    const prev = lastWorking[i] ?? lastWorking[lastWorking.length - 1];
    let weight: number | null = null;
    let targetReps: number | null = null;
    let durationSeconds: number | null = null;
    let distance: number | null = null;
    if (kind === 'weighted') {
      if (presc.kind === 'weighted' && presc.weight !== null) weight = presc.weight;
      else if (prev?.weight !== null && prev?.weight !== undefined) {
        weight = roundTo(convertWeight(prev.weight, (prev.weightUnit as WeightUnit | null) ?? displayUnit, displayUnit), 2);
      }
      targetReps = suggestion.result.action === 'increase' ? target.minReps : (prev?.actualReps ?? target.minReps);
      targetReps = Math.min(Math.max(targetReps, target.minReps), target.maxReps);
    } else if (kind === 'bodyweight') {
      targetReps =
        presc.kind === 'bodyweight' && presc.targetReps !== null
          ? presc.targetReps
          : (prev?.actualReps ?? target.minReps);
      weight = prev?.weight ?? null;
    } else if (kind === 'timed') {
      durationSeconds =
        presc.kind === 'timed' && presc.durationSeconds !== null
          ? presc.durationSeconds
          : (prev?.durationSeconds ?? target.targetDurationSeconds ?? 30);
    } else {
      durationSeconds = presc.kind === 'cardio' ? presc.durationSeconds : null;
      durationSeconds = durationSeconds ?? prev?.durationSeconds ?? target.targetDurationSeconds;
      distance = presc.kind === 'cardio' ? presc.distance : null;
      distance = distance ?? prev?.distance ?? target.targetDistance;
    }
    sets.push({
      setNumber: i + 1,
      targetReps,
      weight,
      weightUnit: weight !== null ? displayUnit : null,
      durationSeconds,
      distance,
    });
  }
  return sets;
}

/**
 * Creates a session from a template with every exercise and planned set pre-filled, in one transaction.
 * Returns the new session id.
 */
export async function startWorkout(db: Db, opts: StartWorkoutOptions): Promise<string> {
  const now = opts.now ?? new Date();
  const nowIso = now.toISOString();
  const template = await routineRepo.getTemplateDetail(db, opts.templateId);
  if (!template) throw new Error('Template not found');
  const routine = await routineRepo.getRoutine(db, template.routineId);
  const prefs = await getPreferences(db, nowIso);
  const displayUnit: WeightUnit = prefs.weightUnit === 'kg' ? 'kg' : 'lb';

  // Compute suggestions outside the transaction (read-only).
  const plans: {
    te: routineRepo.TemplateExerciseDetail;
    suggestion: Awaited<ReturnType<typeof getExerciseSuggestion>>;
    sets: PlannedSet[];
  }[] = [];
  for (const te of template.exercises) {
    const suggestion = await getExerciseSuggestion(db, te.exercise, te, opts.readiness, { displayUnit });
    plans.push({ te, suggestion, sets: planSets(te.exercise, te, suggestion, displayUnit) });
  }

  const sessionId = opts.idFactory();
  await db.transaction(async (tx) => {
    await sessionRepo.insertSession(tx, {
      id: sessionId,
      routineId: template.routineId,
      templateId: template.id,
      routineNameSnapshot: routine?.name ?? '',
      templateNameSnapshot: template.name,
      startedAt: nowIso,
      completedAt: null,
      localDate: localDate(now),
      status: 'in_progress',
      readiness: opts.readiness,
      notes: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    for (const [i, p] of plans.entries()) {
      const seId = opts.idFactory();
      await sessionRepo.insertSessionExercise(tx, {
        id: seId,
        sessionId,
        exerciseId: p.te.exerciseId,
        exerciseNameSnapshot: p.te.exercise.name,
        position: i,
        status: 'pending',
        substitutedFromExerciseId: null,
        restSeconds: p.te.restSeconds,
        targetSets: p.te.targetSets,
        minReps: p.te.minReps,
        maxReps: p.te.maxReps,
        progressionIncrement: p.te.progressionIncrement,
        incrementUnit: p.te.incrementUnit,
        targetDurationSeconds: p.te.targetDurationSeconds,
        targetDistance: p.te.targetDistance,
        notes: null,
      });
      const rows: NewExerciseSetRow[] = p.sets.map((s) => ({
        id: opts.idFactory(),
        sessionExerciseId: seId,
        setNumber: s.setNumber,
        setType: 'working',
        targetReps: s.targetReps,
        actualReps: s.targetReps,
        weight: s.weight,
        weightUnit: s.weightUnit,
        durationSeconds: s.durationSeconds,
        distance: s.distance,
        distanceUnit: s.distance !== null ? prefs.distanceUnit : null,
        rpe: null,
        rir: null,
        completed: 0,
        completedAt: null,
      }));
      await sessionRepo.insertSets(tx, rows);
    }
  });
  return sessionId;
}

/** Adds a substitute exercise after the original one. The original is marked substituted unless it has work logged. */
export async function substituteExercise(
  db: Db,
  sessionId: string,
  sessionExerciseId: string,
  newExerciseId: string,
  idFactory: () => string,
): Promise<string> {
  const detail = await sessionRepo.getSessionDetail(db, sessionId);
  if (!detail) throw new Error('Session not found');
  const original = detail.exercises.find((e) => e.id === sessionExerciseId);
  if (!original) throw new Error('Exercise not in session');
  const replacement = await getExercise(db, newExerciseId);
  if (!replacement) throw new Error('Replacement exercise not found');
  const prefs = await getPreferences(db);
  const displayUnit: WeightUnit = prefs.weightUnit === 'kg' ? 'kg' : 'lb';
  const target: ExerciseTargetLike = {
    targetSets: original.targetSets,
    minReps: original.minReps,
    maxReps: original.maxReps,
    progressionIncrement: replacement.isBodyweight ? 1 : displayUnit === 'kg' ? replacement.defaultIncrementKg : replacement.defaultIncrementLb,
    incrementUnit: displayUnit,
    targetDurationSeconds: original.targetDurationSeconds,
    targetDistance: original.targetDistance,
  };
  const suggestion = await getExerciseSuggestion(db, replacement, target, detail.readiness as Readiness | null, { displayUnit });
  const sets = planSets(replacement, target, suggestion, displayUnit);
  const hasWork = original.sets.some((s) => s.completed === 1);
  const newId = idFactory();
  await db.transaction(async (tx) => {
    if (!hasWork) {
      await sessionRepo.updateSessionExercise(tx, original.id, { status: 'substituted' });
    }
    await sessionRepo.shiftSessionExercisePositions(tx, sessionId, original.position + 1);
    await sessionRepo.insertSessionExercise(tx, {
      id: newId,
      sessionId,
      exerciseId: replacement.id,
      exerciseNameSnapshot: replacement.name,
      position: original.position + 1,
      status: 'pending',
      substitutedFromExerciseId: original.exerciseId,
      restSeconds: original.restSeconds,
      targetSets: target.targetSets,
      minReps: target.minReps,
      maxReps: target.maxReps,
      progressionIncrement: target.progressionIncrement,
      incrementUnit: target.incrementUnit,
      targetDurationSeconds: target.targetDurationSeconds,
      targetDistance: target.targetDistance,
      notes: null,
    });
    await sessionRepo.insertSets(
      tx,
      sets.map((s) => ({
        id: idFactory(),
        sessionExerciseId: newId,
        setNumber: s.setNumber,
        setType: 'working',
        targetReps: s.targetReps,
        actualReps: s.targetReps,
        weight: s.weight,
        weightUnit: s.weightUnit,
        durationSeconds: s.durationSeconds,
        distance: s.distance,
        distanceUnit: s.distance !== null ? prefs.distanceUnit : null,
        rpe: null,
        rir: null,
        completed: 0,
        completedAt: null,
      })),
    );
  });
  return newId;
}

export interface FinishSummary {
  sessionId: string;
  durationSeconds: number;
  exercisesCompleted: number;
  exercisesSkipped: number;
  setsCompleted: number;
  totalVolume: number;
  volumeUnit: WeightUnit;
  recommendations: { exerciseId: string; exerciseName: string; action: string; reason: string }[];
}

/**
 * Marks the session completed, finalises exercise statuses and stores a progression recommendation for every
 * completed exercise. All writes are in one transaction.
 */
export async function finishWorkout(
  db: Db,
  sessionId: string,
  idFactory: () => string,
  now: Date = new Date(),
): Promise<FinishSummary> {
  const detail = await sessionRepo.getSessionDetail(db, sessionId);
  if (!detail) throw new Error('Session not found');
  if (detail.status !== 'in_progress') throw new Error('Session is not in progress');
  const nowIso = now.toISOString();
  const prefs = await getPreferences(db, nowIso);
  const displayUnit: WeightUnit = prefs.weightUnit === 'kg' ? 'kg' : 'lb';

  const statuses = new Map<string, string>();
  for (const e of detail.exercises) {
    if (e.status === 'substituted' || e.status === 'skipped') {
      statuses.set(e.id, e.status);
      continue;
    }
    const any = e.sets.some((s) => s.completed === 1);
    statuses.set(e.id, any ? 'completed' : 'skipped');
  }

  const recoRows: NewRecommendationHistoryRow[] = [];
  const recoSummary: FinishSummary['recommendations'] = [];
  for (const e of detail.exercises) {
    if (statuses.get(e.id) !== 'completed') continue;
    const thisPerformance = { sessionId, performedAt: nowIso, sets: setsToPerformed(e.sets) };
    const { result } = await getExerciseSuggestion(db, e.exercise, e, null, {
      excludeSessionId: sessionId,
      prepend: [thisPerformance],
      displayUnit,
    });
    const p = result.prescription;
    recoRows.push({
      id: idFactory(),
      sessionId,
      exerciseId: e.exerciseId,
      recommendationType: p.kind,
      action: result.action,
      reasonCode: result.reasonCode,
      suggestedWeight: p.kind === 'weighted' ? p.weight : null,
      suggestedWeightUnit: p.kind === 'weighted' ? p.unit : null,
      suggestedReps: p.kind === 'bodyweight' ? p.targetReps : p.kind === 'weighted' ? p.minReps : null,
      suggestedDurationSeconds: p.kind === 'timed' || p.kind === 'cardio' ? p.durationSeconds : null,
      explanation: result.reason,
      prescriptionJson: JSON.stringify(p),
      createdAt: nowIso,
    });
    recoSummary.push({ exerciseId: e.exerciseId, exerciseName: e.exercise.name, action: result.action, reason: result.reason });
  }

  const started = new Date(detail.startedAt).getTime();
  const durationSeconds = Math.max(0, Math.round((now.getTime() - started) / 1000));

  await db.transaction(async (tx) => {
    for (const [id, status] of statuses) {
      await sessionRepo.updateSessionExercise(tx, id, { status });
    }
    await sessionRepo.updateSession(tx, sessionId, {
      status: 'completed',
      completedAt: nowIso,
      durationSeconds,
      restEndsAt: null,
      restDurationSeconds: null,
      restSessionExerciseId: null,
      updatedAt: nowIso,
    });
    await sessionRepo.insertRecommendations(tx, recoRows);
  });

  let setsCompleted = 0;
  let totalVolume = 0;
  for (const e of detail.exercises) {
    if (statuses.get(e.id) !== 'completed') continue;
    for (const s of e.sets) {
      if (s.completed !== 1) continue;
      setsCompleted += 1;
      if (s.weight !== null && s.actualReps !== null) {
        totalVolume += convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? displayUnit, displayUnit) * s.actualReps;
      }
    }
  }
  return {
    sessionId,
    durationSeconds,
    exercisesCompleted: [...statuses.values()].filter((s) => s === 'completed').length,
    exercisesSkipped: [...statuses.values()].filter((s) => s === 'skipped').length,
    setsCompleted,
    totalVolume: roundTo(totalVolume, 0),
    volumeUnit: displayUnit,
    recommendations: recoSummary,
  };
}

export async function abandonWorkout(db: Db, sessionId: string, now: Date = new Date()): Promise<void> {
  const nowIso = now.toISOString();
  await sessionRepo.updateSession(db, sessionId, {
    status: 'abandoned',
    completedAt: nowIso,
    restEndsAt: null,
    restDurationSeconds: null,
    restSessionExerciseId: null,
    updatedAt: nowIso,
  });
}

/** Defensive: keeps only the newest in-progress session, abandoning stale duplicates. */
export async function getResumableSession(db: Db, now: Date = new Date()): Promise<sessionRepo.SessionDetail | null> {
  const open = await sessionRepo.findInProgressSessions(db);
  const [newest, ...stale] = open;
  for (const s of stale) await abandonWorkout(db, s.id, now);
  if (!newest) return null;
  return sessionRepo.getSessionDetail(db, newest.id);
}

export { toTarget };

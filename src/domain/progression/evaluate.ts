import type { ExerciseKind, WeightUnit } from '../models/types';
import { convertWeight } from '@/utils/units';
import type { PerformedExercise, PerformedSet, ProgressionTarget } from './types';

export interface SessionEval {
  working: PerformedSet[];
  completed: PerformedSet[];
  topLoad: number | null;
  setsAtMax: number;
  allAtMax: boolean;
  failed: boolean;
}

function isCompleted(set: PerformedSet, kind: ExerciseKind): boolean {
  if (!set.completed) return false;
  if (kind === 'timed') return set.durationSeconds !== null && set.durationSeconds > 0;
  if (kind === 'cardio') return (set.durationSeconds ?? 0) > 0 || (set.distance ?? 0) > 0;
  return set.actualReps !== null;
}

/** Summarises one session for an exercise. Warm-up sets never count. */
export function evaluateSession(
  session: PerformedExercise,
  target: ProgressionTarget,
  kind: ExerciseKind,
  displayUnit: WeightUnit,
): SessionEval {
  const working = session.sets.filter((s) => s.setType === 'working');
  const completed = working.filter((s) => isCompleted(s, kind));

  let topLoad: number | null = null;
  for (const s of completed) {
    if (s.weight !== null && s.weight !== undefined) {
      const w = convertWeight(s.weight, s.weightUnit ?? displayUnit, displayUnit);
      if (topLoad === null || w > topLoad) topLoad = w;
    }
  }

  const required = Math.max(1, target.targetSets);
  const halfRequired = Math.ceil(required / 2);

  if (kind === 'timed') {
    const goal = target.targetDurationSeconds ?? 0;
    const setsAtMax = completed.filter((s) => (s.durationSeconds ?? 0) >= goal).length;
    const allAtMax = goal > 0 && completed.length >= required && setsAtMax === completed.length;
    const failed =
      completed.length < halfRequired ||
      (goal > 0 && completed.some((s) => (s.durationSeconds ?? 0) < 0.75 * goal));
    return { working, completed, topLoad, setsAtMax, allAtMax, failed };
  }

  if (kind === 'cardio') {
    return { working, completed, topLoad, setsAtMax: 0, allAtMax: false, failed: false };
  }

  const setsAtMax = completed.filter((s) => (s.actualReps ?? 0) >= target.maxReps).length;
  const allAtMax = completed.length >= required && setsAtMax === completed.length;
  const failThreshold = target.minReps - 2;
  const failed =
    completed.length < halfRequired || completed.some((s) => (s.actualReps ?? 0) < failThreshold);
  return { working, completed, topLoad, setsAtMax, allAtMax, failed };
}

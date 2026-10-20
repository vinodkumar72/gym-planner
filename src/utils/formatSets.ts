import type { ExerciseSetRow } from '@/db/schema';
import type { ExerciseKind, WeightUnit } from '@/domain/models/types';
import { convertWeight, formatDuration, roundTo } from './units';

/**
 * Compact one-line summary of completed working sets, e.g. "100×10, 100×10, 100×9" for weighted,
 * "12, 12, 10" for bodyweight, "45s, 45s" for timed, "25m · 2.1 mi" for cardio. Null when nothing was completed.
 */
export function summarizeSets(sets: ExerciseSetRow[], kind: ExerciseKind, unit: WeightUnit): string | null {
  const done = sets.filter((s) => s.setType === 'working' && s.completed === 1);
  if (done.length === 0) return null;
  if (kind === 'timed') return done.map((s) => formatDuration(s.durationSeconds)).join(', ');
  if (kind === 'cardio') {
    const s = done[0];
    if (!s) return null;
    const dist = s.distance !== null ? ` · ${s.distance} ${s.distanceUnit ?? ''}`.trimEnd() : '';
    return `${formatDuration(s.durationSeconds)}${dist}`;
  }
  return done
    .map((s) => {
      const reps = s.actualReps ?? 0;
      if (s.weight === null) return String(reps);
      const w = roundTo(convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? unit, unit), 2);
      return `${w}×${reps}`;
    })
    .join(', ');
}

/** Totals over a session's sets for headline stats. */
export function sessionTotals(
  exercises: { sets: ExerciseSetRow[] }[],
  unit: WeightUnit,
): { sets: number; volume: number } {
  let sets = 0;
  let volume = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      if (s.completed !== 1 || s.setType !== 'working') continue;
      sets += 1;
      if (s.weight !== null && s.actualReps !== null) {
        volume += convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? unit, unit) * s.actualReps;
      }
    }
  }
  return { sets, volume: Math.round(volume) };
}

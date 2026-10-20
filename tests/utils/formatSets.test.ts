import type { ExerciseSetRow } from '@/db/schema';
import { sessionTotals, summarizeSets } from '@/utils/formatSets';

const base: ExerciseSetRow = {
  id: 'x',
  sessionExerciseId: 'se',
  setNumber: 1,
  setType: 'working',
  targetReps: 10,
  actualReps: 10,
  weight: 100,
  weightUnit: 'lb',
  durationSeconds: null,
  distance: null,
  distanceUnit: null,
  rpe: null,
  rir: null,
  completed: 1,
  completedAt: null,
};

describe('formatSets', () => {
  it('summarises weighted sets as weight×reps and skips warm-ups and incomplete sets', () => {
    const sets = [
      { ...base, id: 'w', setType: 'warmup', weight: 60 },
      base,
      { ...base, id: 'b', actualReps: 9 },
      { ...base, id: 'c', completed: 0 },
    ];
    expect(summarizeSets(sets, 'weighted', 'lb')).toBe('100×10, 100×9');
    expect(summarizeSets(sets, 'weighted', 'kg')).toBe('45.36×10, 45.36×9');
    expect(sessionTotals([{ sets }], 'lb')).toEqual({ sets: 2, volume: 1900 });
  });

  it('handles bodyweight, timed and cardio sets', () => {
    expect(
      summarizeSets([{ ...base, weight: null, weightUnit: null, actualReps: 12 }], 'bodyweight', 'lb'),
    ).toBe('12');
    expect(
      summarizeSets([{ ...base, weight: null, actualReps: null, durationSeconds: 45 }], 'timed', 'lb'),
    ).toBe('45s');
    expect(
      summarizeSets(
        [
          {
            ...base,
            weight: null,
            actualReps: null,
            durationSeconds: 1500,
            distance: 2.1,
            distanceUnit: 'mi',
          },
        ],
        'cardio',
        'lb',
      ),
    ).toBe('25m · 2.1 mi');
    expect(summarizeSets([{ ...base, completed: 0 }], 'weighted', 'lb')).toBeNull();
  });
});

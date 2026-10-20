import { computeProgression } from '@/domain/progression';
import type { PerformedExercise, PerformedSet, ProgressionInput } from '@/domain/progression';
import type { WeightUnit } from '@/domain/models/types';

const w = (reps: number | null, weight: number, unit: WeightUnit = 'lb', completed = true): PerformedSet => ({
  setType: 'working',
  completed,
  targetReps: 10,
  actualReps: reps,
  weight,
  weightUnit: unit,
  durationSeconds: null,
  distance: null,
});
const wu = (reps: number, weight: number): PerformedSet => ({ ...w(reps, weight), setType: 'warmup' });
const bw = (reps: number): PerformedSet => ({ ...w(reps, 0), weight: null, weightUnit: null });
const timed = (sec: number): PerformedSet => ({
  setType: 'working',
  completed: true,
  targetReps: null,
  actualReps: null,
  weight: null,
  weightUnit: null,
  durationSeconds: sec,
  distance: null,
});

const session = (sets: PerformedSet[], id = 's1'): PerformedExercise => ({
  sessionId: id,
  performedAt: '2026-10-01T10:00:00.000Z',
  sets,
});

const bench = (overrides: Partial<ProgressionInput> = {}): ProgressionInput => ({
  exercise: { id: 'ex_bench', kind: 'weighted', minLoad: 45, minLoadUnit: 'lb' },
  target: {
    targetSets: 3,
    minReps: 8,
    maxReps: 12,
    progressionIncrement: 5,
    incrementUnit: 'lb',
    targetDurationSeconds: null,
    targetDistance: null,
  },
  displayUnit: 'lb',
  readiness: null,
  history: [],
  ...overrides,
});

function weightOf(r: ReturnType<typeof computeProgression>): number | null {
  return r.prescription.kind === 'weighted' ? r.prescription.weight : null;
}

describe('computeProgression — weighted', () => {
  it('1. no history → review with conservative hint', () => {
    const r = computeProgression(bench());
    expect(r.action).toBe('review');
    expect(r.reasonCode).toBe('NO_HISTORY');
    expect(weightOf(r)).toBeNull();
    expect(r.reason).toMatch(/Start conservatively/);
  });

  it('2. all sets at max → increase by increment', () => {
    const r = computeProgression(bench({ history: [session([w(12, 135), w(12, 135), w(12, 135)])] }));
    expect(r.action).toBe('increase');
    expect(r.reasonCode).toBe('ALL_SETS_AT_MAX');
    expect(weightOf(r)).toBe(140);
    expect(r.basedOn?.setsAtMax).toBe(3);
  });

  it('3. one set below max → maintain', () => {
    const r = computeProgression(bench({ history: [session([w(12, 135), w(12, 135), w(11, 135)])] }));
    expect(r.action).toBe('maintain');
    expect(r.reasonCode).toBe('NOT_ALL_SETS_AT_MAX');
    expect(weightOf(r)).toBe(135);
    expect(r.reason).toMatch(/2 of 3/);
  });

  it('4-5. readiness tired/rest blocks increase', () => {
    for (const readiness of ['tired', 'rest', 'sore'] as const) {
      const r = computeProgression(
        bench({ readiness, history: [session([w(12, 135), w(12, 135), w(12, 135)])] }),
      );
      expect(r.action).toBe('maintain');
      expect(r.reasonCode).toBe('READINESS_BLOCKS_INCREASE');
      expect(weightOf(r)).toBe(135);
      expect(r.reason).toContain(readiness);
    }
  });

  it('6. readiness ready does not block', () => {
    const r = computeProgression(
      bench({ readiness: 'ready', history: [session([w(12, 135), w(12, 135), w(12, 135)])] }),
    );
    expect(r.action).toBe('increase');
    expect(weightOf(r)).toBe(140);
  });

  it('7. failed twice → decrease ~10% floored to step', () => {
    const r = computeProgression(
      bench({
        history: [session([w(5, 135), w(5, 135), w(4, 135)], 's2'), session([w(5, 135), w(5, 135), w(5, 135)], 's1')],
      }),
    );
    expect(r.action).toBe('decrease');
    expect(r.reasonCode).toBe('FAILED_TWO_SESSIONS');
    expect(weightOf(r)).toBe(120);
  });

  it('8. failed once with no prior → review', () => {
    const r = computeProgression(bench({ history: [session([w(5, 135), w(5, 135), w(4, 135)])] }));
    expect(r.action).toBe('review');
    expect(r.reasonCode).toBe('FAILED_ONCE_NO_HISTORY');
    expect(weightOf(r)).toBe(135);
  });

  it('9. failed once with prior success → maintain', () => {
    const r = computeProgression(
      bench({
        history: [
          session([w(5, 135), w(5, 135), w(4, 135)], 's2'),
          session([w(12, 135), w(12, 135), w(12, 135)], 's1'),
        ],
      }),
    );
    expect(r.action).toBe('maintain');
    expect(r.reasonCode).toBe('FAILED_ONCE_PRIOR_OK');
  });

  it('10. fewer than half the sets completed counts as failure', () => {
    const sets = [w(12, 135), w(null, 135, 'lb', false), w(null, 135, 'lb', false)];
    const r = computeProgression(bench({ history: [session(sets, 's2'), session(sets, 's1')] }));
    expect(r.action).toBe('decrease');
    expect(weightOf(r)).toBe(120);
  });

  it('11. warm-up sets are ignored for load and counting', () => {
    const r = computeProgression(
      bench({ history: [session([wu(5, 95), wu(5, 115), w(12, 135), w(12, 135), w(12, 135)])] }),
    );
    expect(r.action).toBe('increase');
    expect(weightOf(r)).toBe(140);
    expect(r.basedOn?.topLoad).toBe(135);
  });

  it('12. decrease clamps to min load', () => {
    const sets = [w(5, 50), w(5, 50), w(5, 50)];
    const r = computeProgression(bench({ history: [session(sets, 's2'), session(sets, 's1')] }));
    expect(r.action).toBe('decrease');
    expect(weightOf(r)).toBe(45);
  });

  it('13. already at min load → AT_MIN_LOAD', () => {
    const sets = [w(5, 45), w(5, 45), w(5, 45)];
    const r = computeProgression(bench({ history: [session(sets, 's2'), session(sets, 's1')] }));
    expect(r.action).toBe('decrease');
    expect(r.reasonCode).toBe('AT_MIN_LOAD');
    expect(weightOf(r)).toBe(45);
    expect(r.reason).toMatch(/minimum load/);
  });

  it('14. kg increments', () => {
    const r = computeProgression(
      bench({
        exercise: { id: 'x', kind: 'weighted', minLoad: 20, minLoadUnit: 'kg' },
        target: { ...bench().target, progressionIncrement: 2.5, incrementUnit: 'kg' },
        displayUnit: 'kg',
        history: [session([w(12, 60, 'kg'), w(12, 60, 'kg'), w(12, 60, 'kg')])],
      }),
    );
    expect(r.action).toBe('increase');
    expect(weightOf(r)).toBe(62.5);
  });

  it('15. mixed units: lb history displayed in kg', () => {
    const r = computeProgression(
      bench({
        target: { ...bench().target, progressionIncrement: 2.5, incrementUnit: 'kg' },
        displayUnit: 'kg',
        roundTo: 1.25,
        history: [session([w(12, 135), w(12, 135), w(12, 135)])],
      }),
    );
    expect(r.action).toBe('increase');
    expect(weightOf(r)).toBe(63.75);
  });

  it('16. kg increment converted to lb and snapped', () => {
    const r = computeProgression(
      bench({
        target: { ...bench().target, progressionIncrement: 1.25, incrementUnit: 'kg' },
        history: [session([w(12, 135), w(12, 135), w(12, 135)])],
      }),
    );
    expect(weightOf(r)).toBe(137.5);
  });

  it('17. fewer sets than target → not all at max', () => {
    const r = computeProgression(
      bench({
        target: { ...bench().target, targetSets: 4 },
        history: [session([w(12, 135), w(12, 135), w(12, 135)])],
      }),
    );
    expect(r.action).toBe('maintain');
    expect(weightOf(r)).toBe(135);
  });

  it('18. extra sets all at max → increase', () => {
    const r = computeProgression(
      bench({ history: [session([w(12, 135), w(12, 135), w(12, 135), w(12, 135)])] }),
    );
    expect(r.action).toBe('increase');
    expect(weightOf(r)).toBe(140);
  });

  it('19. completed set with null reps is not counted', () => {
    const r = computeProgression(bench({ history: [session([w(12, 135), w(12, 135), w(null, 135)])] }));
    expect(r.action).toBe('maintain');
  });

  it('20. only warm-ups → review NO_WORKING_SETS', () => {
    const r = computeProgression(bench({ history: [session([wu(5, 95), wu(5, 115)])] }));
    expect(r.action).toBe('review');
    expect(r.reasonCode).toBe('NO_WORKING_SETS');
  });

  it('32. float safety', () => {
    const r = computeProgression(
      bench({
        exercise: { id: 'ex_db_curl', kind: 'weighted', minLoad: null, minLoadUnit: null },
        target: { ...bench().target, progressionIncrement: 2.5 },
        history: [session([w(12, 22.5), w(12, 22.5), w(12, 22.5)])],
      }),
    );
    expect(weightOf(r)).toBe(25);
  });
});

describe('computeProgression — bodyweight', () => {
  const pullups = (history: PerformedExercise[], readiness: ProgressionInput['readiness'] = null): ProgressionInput => ({
    exercise: { id: 'ex_pullup', kind: 'bodyweight', minLoad: null, minLoadUnit: null },
    target: {
      targetSets: 3,
      minReps: 5,
      maxReps: 8,
      progressionIncrement: 1,
      incrementUnit: 'lb',
      targetDurationSeconds: null,
      targetDistance: null,
    },
    displayUnit: 'lb',
    readiness,
    history,
  });

  it('21. all at max → increase reps', () => {
    const r = computeProgression(pullups([session([bw(8), bw(8), bw(8)])]));
    expect(r.action).toBe('increase');
    expect(r.prescription).toMatchObject({ kind: 'bodyweight', targetReps: 9 });
  });

  it('22. not all at max → maintain', () => {
    const r = computeProgression(pullups([session([bw(8), bw(7), bw(8)])]));
    expect(r.action).toBe('maintain');
    expect(r.prescription).toMatchObject({ kind: 'bodyweight', targetReps: 8 });
  });

  it('23. failed twice → decrease to min reps with easier variation', () => {
    const r = computeProgression(pullups([session([bw(2), bw(2), bw(1)], 's2'), session([bw(2), bw(2), bw(2)], 's1')]));
    expect(r.action).toBe('decrease');
    expect(r.prescription).toMatchObject({ kind: 'bodyweight', targetReps: 5 });
    expect(r.reason).toMatch(/easier variation/);
  });
});

describe('computeProgression — timed', () => {
  const plank = (history: PerformedExercise[], targetDurationSeconds: number | null = 60): ProgressionInput => ({
    exercise: { id: 'ex_plank', kind: 'timed', minLoad: null, minLoadUnit: null },
    target: {
      targetSets: 3,
      minReps: 0,
      maxReps: 0,
      progressionIncrement: 10,
      incrementUnit: 'lb',
      targetDurationSeconds,
      targetDistance: null,
    },
    displayUnit: 'lb',
    readiness: null,
    history,
  });

  it('24. all sets hit target → increase seconds', () => {
    const r = computeProgression(plank([session([timed(60), timed(60), timed(60)])]));
    expect(r.action).toBe('increase');
    expect(r.prescription).toMatchObject({ kind: 'timed', durationSeconds: 70 });
  });

  it('25. failed twice → decrease', () => {
    const r = computeProgression(
      plank([session([timed(60), timed(40), timed(30)], 's2'), session([timed(60), timed(45), timed(30)], 's1')]),
    );
    expect(r.action).toBe('decrease');
    expect(r.prescription).toMatchObject({ kind: 'timed', durationSeconds: 50 });
  });

  it('26. mostly there → maintain', () => {
    const r = computeProgression(plank([session([timed(60), timed(55), timed(60)])]));
    expect(r.action).toBe('maintain');
    expect(r.prescription).toMatchObject({ kind: 'timed', durationSeconds: 60 });
  });

  it('27. missing target duration → review', () => {
    const r = computeProgression(plank([session([timed(60), timed(60), timed(60)])], null));
    expect(r.action).toBe('review');
    expect(r.reasonCode).toBe('NO_TARGET_DURATION');
  });
});

describe('computeProgression — cardio', () => {
  const run = (history: PerformedExercise[], readiness: ProgressionInput['readiness'] = null): ProgressionInput => ({
    exercise: { id: 'ex_run', kind: 'cardio', minLoad: null, minLoadUnit: null },
    target: {
      targetSets: 1,
      minReps: 0,
      maxReps: 0,
      progressionIncrement: 0,
      incrementUnit: 'lb',
      targetDurationSeconds: 1800,
      targetDistance: 5,
    },
    displayUnit: 'lb',
    readiness,
    history,
  });
  const cardioSet: PerformedSet = {
    setType: 'working',
    completed: true,
    targetReps: null,
    actualReps: null,
    weight: null,
    weightUnit: null,
    durationSeconds: 1800,
    distance: 5,
  };

  it('28. suggests 5-10% more', () => {
    const r = computeProgression(run([session([cardioSet])]));
    expect(r.action).toBe('maintain');
    expect(r.reasonCode).toBe('CARDIO_SUGGEST');
    expect(r.prescription).toMatchObject({
      kind: 'cardio',
      suggestion: { durationSeconds: [1890, 1980], distance: [5.25, 5.5] },
    });
  });

  it('29. readiness sore → hold', () => {
    const r = computeProgression(run([session([cardioSet])], 'sore'));
    expect(r.reasonCode).toBe('CARDIO_HOLD');
    expect(r.prescription).toMatchObject({ kind: 'cardio', suggestion: null });
  });

  it('30. no history → review', () => {
    const r = computeProgression(run([]));
    expect(r.action).toBe('review');
    expect(r.reasonCode).toBe('NO_HISTORY');
  });
});

describe('computeProgression — invariants', () => {
  it('31. every result has a non-empty reason', () => {
    const inputs: ProgressionInput[] = [
      bench(),
      bench({ history: [session([w(12, 135), w(12, 135), w(12, 135)])] }),
      bench({ history: [session([w(5, 135), w(5, 135), w(4, 135)])] }),
      bench({ readiness: 'tired', history: [session([w(12, 135), w(12, 135), w(12, 135)])] }),
    ];
    for (const i of inputs) {
      expect(computeProgression(i).reason.length).toBeGreaterThan(10);
    }
  });

  it('is deterministic and does not mutate input', () => {
    const input = bench({ history: [session([w(12, 135), w(12, 135), w(12, 135)])] });
    const snapshot = JSON.stringify(input);
    const a = computeProgression(input);
    const b = computeProgression(input);
    expect(a).toEqual(b);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

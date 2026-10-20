import { nextWorkout } from '@/domain/workout-engine';
import type { ActiveRoutine, NextWorkoutInput, SessionSummary } from '@/domain/workout-engine';

const rotation: ActiveRoutine = {
  id: 'R1',
  name: 'PPL',
  rotationType: 'rotation',
  activatedAt: null,
  templates: [
    { id: 'A', name: 'Push', position: 0 },
    { id: 'B', name: 'Pull', position: 1 },
    { id: 'C', name: 'Legs', position: 2 },
  ],
  schedule: [],
};

const calendar: ActiveRoutine = {
  id: 'R2',
  name: 'Cal PPL',
  rotationType: 'calendar',
  activatedAt: null,
  templates: [
    { id: 'push', name: 'Push', position: 0 },
    { id: 'pull', name: 'Pull', position: 1 },
    { id: 'legs', name: 'Legs', position: 2 },
  ],
  schedule: [
    { dayOfWeek: 1, templateId: 'push' },
    { dayOfWeek: 3, templateId: 'pull' },
    { dayOfWeek: 5, templateId: 'legs' },
  ],
};

// 2026-10-14 is a Wednesday
const wed = new Date(2026, 9, 14, 9, 0, 0);
const tue = new Date(2026, 9, 13, 9, 0, 0);
const mon19 = new Date(2026, 9, 19, 9, 0, 0);

function done(templateId: string, date: string, routineId = 'R2', id = `${templateId}-${date}`): SessionSummary {
  const [y, m, d] = date.split('-').map(Number);
  const started = new Date(y ?? 2026, (m ?? 1) - 1, d ?? 1, 10, 0, 0).toISOString();
  return {
    id,
    routineId,
    templateId,
    templateName: templateId,
    status: 'completed',
    startedAt: started,
    completedAt: started,
  };
}

const base = (overrides: Partial<NextWorkoutInput>): NextWorkoutInput => ({
  routine: rotation,
  inProgressSession: null,
  lastCompletedSession: null,
  recentCompletedSessions: [],
  readiness: null,
  now: wed,
  ...overrides,
});

describe('nextWorkout — priority', () => {
  it('1. resumes an in-progress session regardless of readiness', () => {
    const s = { ...done('A', '2026-10-14', 'R1'), status: 'in_progress' as const, completedAt: null };
    const r = nextWorkout(base({ inProgressSession: s, readiness: 'rest' }));
    expect(r.kind).toBe('resume');
    if (r.kind === 'resume') expect(r.sessionId).toBe(s.id);
  });

  it('2. no routine', () => {
    expect(nextWorkout(base({ routine: null })).kind).toBe('no_routine');
  });

  it('3. routine with no templates', () => {
    expect(nextWorkout(base({ routine: { ...rotation, templates: [] } })).kind).toBe('no_routine');
  });
});

describe('nextWorkout — rotation', () => {
  it('4. first workout with no history', () => {
    const r = nextWorkout(base({}));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'A', position: 0, intensity: 'normal' } });
  });

  it('5. next after last completed', () => {
    const r = nextWorkout(base({ lastCompletedSession: done('A', '2026-10-13', 'R1') }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'B' } });
  });

  it('6. wraps around', () => {
    const r = nextWorkout(base({ lastCompletedSession: done('C', '2026-10-13', 'R1') }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'A' } });
  });

  it('7. missed days do not skip', () => {
    const r = nextWorkout(base({ lastCompletedSession: done('A', '2026-09-30', 'R1') }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'B' } });
  });

  it('8. routine changed → start from top', () => {
    const r = nextWorkout(base({ lastCompletedSession: done('B', '2026-10-13', 'OLD') }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'A' } });
    if (r.kind === 'workout') expect(r.reason).toMatch(/switched/);
  });

  it('9. deleted template → start from top with explanation', () => {
    const r = nextWorkout(base({ lastCompletedSession: done('deleted', '2026-10-13', 'R1') }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'A' } });
    if (r.kind === 'workout') expect(r.reason).toMatch(/no longer/);
  });

  it('10. abandoned sessions are not "last completed"', () => {
    const r = nextWorkout(base({ lastCompletedSession: null }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'A' } });
  });
});

describe('nextWorkout — calendar', () => {
  it('11. scheduled workout, nothing missed', () => {
    const r = nextWorkout(
      base({ routine: calendar, recentCompletedSessions: [done('push', '2026-10-12')] }),
    );
    expect(r).toMatchObject({
      kind: 'workout',
      option: { templateId: 'pull', role: 'scheduled', scheduledFor: '2026-10-14' },
    });
  });

  it('12. missed Monday → choice', () => {
    const r = nextWorkout(base({ routine: calendar }));
    expect(r).toMatchObject({
      kind: 'choice',
      missed: { templateId: 'push', scheduledFor: '2026-10-12' },
      scheduled: { templateId: 'pull' },
    });
  });

  it('13. late completion satisfies the missed day', () => {
    const r = nextWorkout(
      base({ routine: calendar, recentCompletedSessions: [done('push', '2026-10-13')] }),
    );
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'pull' } });
  });

  it('14. rest day with a missed workout → choice with null scheduled', () => {
    const r = nextWorkout(base({ routine: calendar, now: tue }));
    expect(r).toMatchObject({ kind: 'choice', missed: { templateId: 'push' }, scheduled: null });
  });

  it('15. rest day, nothing missed', () => {
    const r = nextWorkout(
      base({ routine: calendar, now: tue, recentCompletedSessions: [done('push', '2026-10-12')] }),
    );
    expect(r).toMatchObject({ kind: 'rest_day', source: 'calendar', override: null });
  });

  it('16. already completed today', () => {
    const r = nextWorkout(
      base({
        routine: calendar,
        recentCompletedSessions: [done('push', '2026-10-12'), done('pull', '2026-10-14')],
      }),
    );
    expect(r).toMatchObject({ kind: 'rest_day', source: 'completed_today' });
  });

  it('17. missed days before activation are ignored', () => {
    const r = nextWorkout(
      base({ routine: { ...calendar, activatedAt: new Date(2026, 9, 13, 8).toISOString() } }),
    );
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'pull' } });
  });

  it('18. lookback window of 3 catches Friday from Monday', () => {
    const r = nextWorkout(base({ routine: calendar, now: mon19, recentCompletedSessions: [] }));
    expect(r).toMatchObject({ kind: 'choice', missed: { templateId: 'legs' }, scheduled: { templateId: 'push' } });
  });

  it('19. lookback window of 2 does not', () => {
    const r = nextWorkout(base({ routine: calendar, now: mon19, missedLookbackDays: 2 }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'push' } });
  });

  it('20. same template scheduled twice collapses', () => {
    const twice: ActiveRoutine = {
      ...calendar,
      schedule: [
        { dayOfWeek: 1, templateId: 'pull' },
        { dayOfWeek: 3, templateId: 'pull' },
      ],
    };
    const r = nextWorkout(base({ routine: twice }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'pull' } });
  });
});

describe('nextWorkout — readiness', () => {
  it('21. tired → reduced intensity', () => {
    const r = nextWorkout(base({ lastCompletedSession: done('A', '2026-10-13', 'R1'), readiness: 'tired' }));
    expect(r).toMatchObject({ kind: 'workout', option: { templateId: 'B', intensity: 'reduced' } });
    if (r.kind === 'workout') expect(r.reason).toMatch(/tired/);
  });

  it('22. sore applies to both choice options', () => {
    const r = nextWorkout(base({ routine: calendar, readiness: 'sore' }));
    expect(r).toMatchObject({
      kind: 'choice',
      missed: { intensity: 'reduced' },
      scheduled: { intensity: 'reduced' },
    });
  });

  it('23. rest wraps with override', () => {
    const r = nextWorkout(base({ lastCompletedSession: done('A', '2026-10-13', 'R1'), readiness: 'rest' }));
    expect(r).toMatchObject({ kind: 'rest_day', source: 'readiness' });
    if (r.kind === 'rest_day') {
      expect(r.override?.kind).toBe('workout');
      if (r.override?.kind === 'workout') expect(r.override.option.templateId).toBe('B');
    }
  });

  it('24. rest on a calendar rest day is not double-wrapped', () => {
    const r = nextWorkout(
      base({
        routine: calendar,
        now: tue,
        readiness: 'rest',
        recentCompletedSessions: [done('push', '2026-10-12')],
      }),
    );
    expect(r).toMatchObject({ kind: 'rest_day', source: 'calendar', override: null });
  });

  it('25. pure: same input, same output, now not mutated', () => {
    const now = new Date(2026, 9, 14, 9);
    const input = base({ routine: calendar, now });
    const t = now.getTime();
    expect(nextWorkout(input)).toEqual(nextWorkout(input));
    expect(now.getTime()).toBe(t);
  });
});

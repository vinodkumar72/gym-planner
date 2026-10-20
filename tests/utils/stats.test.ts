import {
  consistency,
  estimateOneRepMax,
  exerciseTrend,
  mondayOf,
  personalRecords,
  weeklyFrequency,
} from '@/domain/analytics/stats';
import {
  convertWeight,
  floorToStep,
  formatClock,
  formatWeight,
  roundTo,
  roundToStep,
  stepperStep,
} from '@/utils/units';

describe('units', () => {
  it('converts and rounds without drift', () => {
    expect(roundTo(0.1 + 0.2, 2)).toBe(0.3);
    expect(roundTo(convertWeight(100, 'lb', 'kg'), 2)).toBe(45.36);
    expect(roundTo(convertWeight(45.36, 'kg', 'lb'), 1)).toBe(100);
    expect(roundToStep(103.76, 2.5)).toBe(105);
    expect(roundToStep(22.5 + 2.5, 2.5)).toBe(25);
    expect(floorToStep(121.5, 2.5)).toBe(120);
    expect(formatWeight(102.5, 'lb')).toBe('102.5 lb');
    expect(formatWeight(100, 'kg')).toBe('100 kg');
    expect(formatClock(95)).toBe('1:35');
  });

  it('derives the workout stepper step from the exercise increment', () => {
    expect(stepperStep(5, 'lb', 'lb')).toBe(5);
    expect(stepperStep(10, 'lb', 'lb')).toBe(10);
    expect(stepperStep(2.5, 'lb', 'lb')).toBe(2.5);
    expect(stepperStep(5, 'lb', 'kg')).toBe(2.5); // 2.27 kg snaps to 2.5
    expect(stepperStep(2.5, 'kg', 'lb')).toBe(5); // 5.5 lb snaps to 5
    expect(stepperStep(0, 'lb', 'lb')).toBe(5); // unset → sensible default
    expect(stepperStep(1, 'lb', 'lb')).toBe(2.5); // never below a plate step
  });
});

describe('stats', () => {
  it('estimates 1RM with Epley', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100);
    expect(estimateOneRepMax(100, 10)).toBe(133.3);
  });

  it('builds a trend and PRs from sets', () => {
    const sets = [
      {
        localDate: '2026-10-01',
        sessionId: 'a',
        weight: 100,
        weightUnit: 'lb',
        actualReps: 10,
        durationSeconds: null,
      },
      {
        localDate: '2026-10-01',
        sessionId: 'a',
        weight: 100,
        weightUnit: 'lb',
        actualReps: 8,
        durationSeconds: null,
      },
      {
        localDate: '2026-10-04',
        sessionId: 'b',
        weight: 105,
        weightUnit: 'lb',
        actualReps: 8,
        durationSeconds: null,
      },
    ];
    const trend = exerciseTrend(sets, 'lb');
    expect(trend).toHaveLength(2);
    expect(trend[0]).toMatchObject({ localDate: '2026-10-01', topWeight: 100, topReps: 10, volume: 1800 });
    expect(trend[1]?.topWeight).toBe(105);
    const pr = personalRecords(sets, 'lb');
    expect(pr.bestWeight).toMatchObject({ weight: 105, reps: 8 });
    expect(pr.bestReps).toMatchObject({ reps: 10 });
    expect(pr.bestEst1rm?.value).toBe(133.3);
  });

  it('weekly frequency and streaks', () => {
    expect(mondayOf('2026-10-14')).toBe('2026-10-12');
    expect(mondayOf('2026-10-11')).toBe('2026-10-05');
    const dates = [
      '2026-09-28',
      '2026-09-30',
      '2026-10-02',
      '2026-10-05',
      '2026-10-07',
      '2026-10-09',
      '2026-10-13',
    ];
    const weeks = weeklyFrequency(dates, '2026-10-14', 4);
    expect(weeks.map((w) => w.sessions)).toEqual([0, 3, 3, 1]);
    const s = consistency(dates, '2026-10-14', 3);
    expect(s.currentWeekStreak).toBe(2); // this week incomplete → count from last week
    expect(s.longestWeekStreak).toBe(2);
    expect(s.daysSinceLast).toBe(1);
    expect(s.thisWeekSessions).toBe(1);
  });
});

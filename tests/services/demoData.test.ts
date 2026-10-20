import * as routineRepo from '@/db/repositories/routineRepo';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { seedDatabase } from '@/db/seed';
import { loadDemoData } from '@/services/demoDataService';
import { progressOverview } from '@/services/historyService';
import { getTodayRecommendation } from '@/services/recommendationService';
import { createTestDb } from '../helpers/testDb';

let n = 0;
const idFactory = () => `demo-${++n}`;

describe('demo data', () => {
  it('generates weeks of progressive history through the real workout pipeline', async () => {
    const db = await createTestDb();
    await seedDatabase(db);
    await routineRepo.activateRoutine(db, 'rt_ppl', '2026-08-01T08:00:00.000Z');
    const now = new Date(2026, 9, 19, 9);
    const { sessions } = await loadDemoData(db, { weeks: 8, sessionsPerWeek: 3, now, idFactory });
    expect(sessions).toBeGreaterThanOrEqual(18);
    expect(await sessionRepo.countCompletedSessions(db)).toBe(sessions);

    // loads should have progressed: last bench session heavier than the first
    const all = await sessionRepo.getAllCompletedSetsForExercise(db, 'ex_bench_press');
    const first = all[0]?.weight ?? 0;
    const last = all[all.length - 1]?.weight ?? 0;
    expect(last).toBeGreaterThan(first);

    const overview = await progressOverview(db, now, 8);
    expect(overview.totalSessions).toBe(sessions);
    expect(overview.trainedExercises.length).toBeGreaterThan(8);

    const reco = await getTodayRecommendation(db, null, now);
    expect(reco.kind).toBe('workout');

    await expect(loadDemoData(db, { now, idFactory })).rejects.toThrow(/empty workout history/);
  });
});

import { eq } from 'drizzle-orm';
import { exercises, sessionExercises } from '@/db/schema';
import * as exerciseRepo from '@/db/repositories/exerciseRepo';
import * as routineRepo from '@/db/repositories/routineRepo';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { getPreferences, updatePreferences } from '@/db/repositories/preferencesRepo';
import { seedDatabase } from '@/db/seed';
import { createTestDb } from '../helpers/testDb';

const now = '2026-10-05T10:00:00.000Z';

describe('database integrity', () => {
  it('custom exercise CRUD', async () => {
    const db = await createTestDb();
    await exerciseRepo.insertExercise(db, {
      id: 'cx1',
      name: 'Landmine Press',
      primaryMuscleGroup: 'shoulders',
      equipment: 'barbell',
      exerciseType: 'strength',
      isCustom: 1,
      createdAt: now,
      updatedAt: now,
    });
    expect((await exerciseRepo.getExercise(db, 'cx1'))?.name).toBe('Landmine Press');
    await exerciseRepo.updateExercise(db, 'cx1', { name: 'Landmine Press (Single Arm)' });
    expect((await exerciseRepo.listExercises(db, { search: 'landmine' }))[0]?.name).toContain('Single Arm');
    await exerciseRepo.setExerciseArchived(db, 'cx1', true, now);
    expect(await exerciseRepo.listExercises(db, { search: 'landmine' })).toHaveLength(0);
    expect(await exerciseRepo.listExercises(db, { search: 'landmine', includeArchived: true })).toHaveLength(1);
    await exerciseRepo.deleteExercise(db, 'cx1');
    expect(await exerciseRepo.getExercise(db, 'cx1')).toBeNull();
  });

  it('refuses to delete an exercise referenced by history (FK restrict)', async () => {
    const db = await createTestDb();
    await seedDatabase(db);
    await sessionRepo.insertSession(db, {
      id: 's1',
      startedAt: now,
      localDate: '2026-10-05',
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    });
    await sessionRepo.insertSessionExercise(db, {
      id: 'se1',
      sessionId: 's1',
      exerciseId: 'ex_squat',
      position: 0,
    });
    await expect(db.delete(exercises).where(eq(exercises.id, 'ex_squat'))).rejects.toThrow();
  });

  it('cascades session deletion to exercises and sets, and set-nulls template on session', async () => {
    const db = await createTestDb();
    await seedDatabase(db);
    await sessionRepo.insertSession(db, {
      id: 's1',
      templateId: 'tp_ppl_push',
      routineId: 'rt_ppl',
      startedAt: now,
      localDate: '2026-10-05',
      status: 'completed',
      createdAt: now,
      updatedAt: now,
    });
    await sessionRepo.insertSessionExercise(db, { id: 'se1', sessionId: 's1', exerciseId: 'ex_squat', position: 0 });
    await sessionRepo.insertSet(db, { id: 'set1', sessionExerciseId: 'se1', setNumber: 1 });
    await routineRepo.deleteTemplate(db, 'tp_ppl_push');
    expect((await sessionRepo.getSession(db, 's1'))?.templateId).toBeNull();
    await sessionRepo.deleteSession(db, 's1');
    expect(await db.select().from(sessionExercises)).toHaveLength(0);
    expect(await sessionRepo.getSetsForSessionExercise(db, 'se1')).toHaveLength(0);
  });

  it('exactly one routine is active and schedule days are unique', async () => {
    const db = await createTestDb();
    await seedDatabase(db);
    await routineRepo.activateRoutine(db, 'rt_ppl', now);
    await routineRepo.activateRoutine(db, 'rt_full_body', now);
    const all = await routineRepo.listRoutines(db);
    expect(all.filter((r) => r.isActive === 1).map((r) => r.id)).toEqual(['rt_full_body']);
    let n = 0;
    const ids = () => `sch-${++n}`;
    await routineRepo.setScheduleDay(db, 'rt_ppl', 1, 'tp_ppl_push', ids);
    await routineRepo.setScheduleDay(db, 'rt_ppl', 1, 'tp_ppl_pull', ids);
    const sched = await routineRepo.getScheduleForRoutine(db, 'rt_ppl');
    expect(sched).toHaveLength(1);
    expect(sched[0]?.templateId).toBe('tp_ppl_pull');
  });

  it('preferences are created on demand and updated', async () => {
    const db = await createTestDb();
    const p = await getPreferences(db, now);
    expect(p.weightUnit).toBe('lb');
    const u = await updatePreferences(db, { weightUnit: 'kg', trainingDaysPerWeek: 4 }, now);
    expect(u.weightUnit).toBe('kg');
    expect(u.trainingDaysPerWeek).toBe(4);
  });

  it('handles thousands of sessions with indexed queries', async () => {
    const db = await createTestDb();
    await seedDatabase(db);
    await db.transaction(async (tx) => {
      for (let i = 0; i < 2000; i += 1) {
        const d = new Date(2020, 0, 1 + i);
        const iso = d.toISOString();
        const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        await sessionRepo.insertSession(tx, {
          id: `s${i}`,
          routineId: 'rt_ppl',
          templateId: 'tp_ppl_push',
          templateNameSnapshot: 'Push Day',
          startedAt: iso,
          completedAt: iso,
          localDate: local,
          status: 'completed',
          createdAt: iso,
          updatedAt: iso,
        });
        await sessionRepo.insertSessionExercise(tx, {
          id: `se${i}`,
          sessionId: `s${i}`,
          exerciseId: 'ex_bench_press',
          position: 0,
          status: 'completed',
        });
        await sessionRepo.insertSets(tx, [
          { id: `set${i}a`, sessionExerciseId: `se${i}`, setNumber: 1, actualReps: 10, weight: 100 + (i % 20), weightUnit: 'lb', completed: 1 },
          { id: `set${i}b`, sessionExerciseId: `se${i}`, setNumber: 2, actualReps: 10, weight: 100 + (i % 20), weightUnit: 'lb', completed: 1 },
        ]);
      }
    });
    const t0 = Date.now();
    expect(await sessionRepo.countCompletedSessions(db)).toBe(2000);
    const last = await sessionRepo.getLastCompletedSession(db);
    expect(last?.id).toBe('s1999');
    const hist = await sessionRepo.getExerciseHistory(db, 'ex_bench_press', 2);
    expect(hist).toHaveLength(2);
    expect(hist[0]?.sets).toHaveLength(2);
    const page = await sessionRepo.listSessions(db, { limit: 20 });
    expect(page).toHaveLength(20);
    expect(Date.now() - t0).toBeLessThan(2000);
  });
});

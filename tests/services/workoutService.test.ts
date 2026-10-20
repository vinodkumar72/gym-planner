import { eq } from 'drizzle-orm';
import { exerciseSets, recommendationHistory, sessionExercises, workoutSessions } from '@/db/schema';
import * as routineRepo from '@/db/repositories/routineRepo';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { seedDatabase } from '@/db/seed';
import { getTodayRecommendation } from '@/services/recommendationService';
import { abandonWorkout, finishWorkout, getResumableSession, startWorkout, substituteExercise } from '@/services/workoutService';
import { duplicateRoutine } from '@/services/routineService';
import { createTestDb } from '../helpers/testDb';

let counter = 0;
const idFactory = () => `id-${++counter}`;

async function setup() {
  const db = await createTestDb();
  await seedDatabase(db);
  await routineRepo.activateRoutine(db, 'rt_ppl', '2026-10-01T08:00:00.000Z');
  return db;
}

async function completeAllSets(db: Awaited<ReturnType<typeof setup>>, sessionId: string, reps: number, weight: number) {
  const detail = await sessionRepo.getSessionDetail(db, sessionId);
  if (!detail) throw new Error('no session');
  for (const e of detail.exercises) {
    for (const s of e.sets) {
      await sessionRepo.updateSet(db, s.id, {
        actualReps: reps,
        weight: e.exercise.isBodyweight ? null : weight,
        weightUnit: e.exercise.isBodyweight ? null : 'lb',
        completed: 1,
        completedAt: '2026-10-05T10:30:00.000Z',
      });
    }
  }
}

describe('workoutService', () => {
  it('starts a workout with every exercise and planned set prefilled', async () => {
    const db = await setup();
    const id = await startWorkout(db, {
      templateId: 'tp_ppl_push',
      readiness: 'ready',
      now: new Date(2026, 9, 5, 10),
      idFactory,
    });
    const detail = await sessionRepo.getSessionDetail(db, id);
    expect(detail?.status).toBe('in_progress');
    expect(detail?.templateNameSnapshot).toBe('Push Day');
    expect(detail?.localDate).toBe('2026-10-05');
    expect(detail?.exercises).toHaveLength(4);
    expect(detail?.exercises[0]?.sets).toHaveLength(3);
    // no history → no weight fabricated
    expect(detail?.exercises[0]?.sets[0]?.weight).toBeNull();
    expect(detail?.exercises[0]?.sets[0]?.completed).toBe(0);
  });

  it('is resumable, and finishing stores recommendations and completes the session', async () => {
    const db = await setup();
    const id = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 5, 10), idFactory });
    const resumable = await getResumableSession(db);
    expect(resumable?.id).toBe(id);

    await completeAllSets(db, id, 10, 100);
    const summary = await finishWorkout(db, id, idFactory, new Date(2026, 9, 5, 11));
    expect(summary.exercisesCompleted).toBe(4);
    expect(summary.setsCompleted).toBe(12);
    expect(summary.durationSeconds).toBe(3600);
    expect(summary.recommendations).toHaveLength(4);

    const session = await sessionRepo.getSession(db, id);
    expect(session?.status).toBe('completed');
    const recos = await db.select().from(recommendationHistory).where(eq(recommendationHistory.sessionId, id));
    expect(recos).toHaveLength(4);
    expect(recos.every((r) => r.explanation.length > 0)).toBe(true);
    expect(await getResumableSession(db)).toBeNull();
  });

  it('prefills the next session from the previous one and applies double progression', async () => {
    const db = await setup();
    const first = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 5, 10), idFactory });
    await completeAllSets(db, first, 10, 100);
    await finishWorkout(db, first, idFactory, new Date(2026, 9, 5, 11));

    const second = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 8, 10), idFactory });
    const d2 = await sessionRepo.getSessionDetail(db, second);
    const bench = d2?.exercises.find((e) => e.exerciseId === 'ex_bench_press');
    expect(bench?.sets[0]?.weight).toBe(105); // 3x10 hit max of 8-10 → +5
    expect(bench?.sets[0]?.weightUnit).toBe('lb');
    const curls = d2?.exercises.find((e) => e.exerciseId === 'ex_tricep_pushdown');
    expect(curls?.sets[0]?.weight).toBe(100); // 10 reps < max 12 → maintain
  });

  it('readiness tired blocks increase when starting the next session', async () => {
    const db = await setup();
    const first = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 5, 10), idFactory });
    await completeAllSets(db, first, 10, 100);
    await finishWorkout(db, first, idFactory, new Date(2026, 9, 5, 11));
    const second = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: 'tired', now: new Date(2026, 9, 8, 10), idFactory });
    const d2 = await sessionRepo.getSessionDetail(db, second);
    const bench = d2?.exercises.find((e) => e.exerciseId === 'ex_bench_press');
    expect(bench?.sets[0]?.weight).toBe(100);
  });

  it('rotation recommends the next template after finishing', async () => {
    const db = await setup();
    let reco = await getTodayRecommendation(db, null, new Date(2026, 9, 5, 9));
    expect(reco).toMatchObject({ kind: 'workout', option: { templateId: 'tp_ppl_push' } });

    const id = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 5, 10), idFactory });
    reco = await getTodayRecommendation(db, null, new Date(2026, 9, 5, 10, 30));
    expect(reco.kind).toBe('resume');

    await completeAllSets(db, id, 8, 100);
    await finishWorkout(db, id, idFactory, new Date(2026, 9, 5, 11));
    reco = await getTodayRecommendation(db, null, new Date(2026, 9, 9, 9));
    expect(reco).toMatchObject({ kind: 'workout', option: { templateId: 'tp_ppl_pull' } });
  });

  it('abandoned sessions do not advance rotation and are not resumable', async () => {
    const db = await setup();
    const id = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 5, 10), idFactory });
    await abandonWorkout(db, id, new Date(2026, 9, 5, 10, 5));
    expect(await getResumableSession(db)).toBeNull();
    const reco = await getTodayRecommendation(db, null, new Date(2026, 9, 6, 9));
    expect(reco).toMatchObject({ kind: 'workout', option: { templateId: 'tp_ppl_push' } });
  });

  it('substitutes an exercise, keeping the original row for history', async () => {
    const db = await setup();
    const id = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 5, 10), idFactory });
    const before = await sessionRepo.getSessionDetail(db, id);
    const bench = before?.exercises[0];
    if (!bench) throw new Error('missing');
    const newId = await substituteExercise(db, id, bench.id, 'ex_db_bench_press', idFactory);
    const after = await sessionRepo.getSessionDetail(db, id);
    expect(after?.exercises).toHaveLength(5);
    expect(after?.exercises[0]?.status).toBe('substituted');
    expect(after?.exercises[1]?.id).toBe(newId);
    expect(after?.exercises[1]?.substitutedFromExerciseId).toBe('ex_bench_press');
    expect(after?.exercises[2]?.position).toBe(2);
  });

  it('history survives template edits and routine deletion', async () => {
    const db = await setup();
    const id = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: null, now: new Date(2026, 9, 5, 10), idFactory });
    await completeAllSets(db, id, 10, 100);
    await finishWorkout(db, id, idFactory, new Date(2026, 9, 5, 11));

    const copyId = await duplicateRoutine(db, 'rt_ppl', idFactory);
    const copy = await routineRepo.getRoutineDetail(db, copyId);
    expect(copy?.templates).toHaveLength(3);
    expect(copy?.templates[0]?.exercises).toHaveLength(4);

    // delete the template that the session referenced
    await routineRepo.deleteTemplate(db, 'tp_ppl_push');
    const session = await sessionRepo.getSession(db, id);
    expect(session?.templateId).toBeNull();
    expect(session?.templateNameSnapshot).toBe('Push Day');
    const ex = await db.select().from(sessionExercises).where(eq(sessionExercises.sessionId, id));
    expect(ex).toHaveLength(4);
    const sets = await db.select().from(exerciseSets);
    expect(sets.length).toBe(12);
    const sessions = await db.select().from(workoutSessions);
    expect(sessions).toHaveLength(1);
  });
});

/**
 * Exercises the active-workout store end to end against a real in-memory database:
 * start → complete sets → add/remove sets → rest timer → "app restart" (hydrate) → finish.
 */
import { eq } from 'drizzle-orm';
import { exerciseSets, workoutSessions } from '@/db/schema';
import * as routineRepo from '@/db/repositories/routineRepo';
import { seedDatabase } from '@/db/seed';
import type { Db } from '@/db/types';
import { createTestDb } from '../helpers/testDb';

let mockCounter = 0;
jest.mock('expo-crypto', () => ({ randomUUID: () => `uuid-${++mockCounter}` }));

let mockDb: Db;
jest.mock('@/db/client', () => ({
  getDb: () => mockDb,
  getExpoDb: () => mockDb,
  setDbForTesting: () => undefined,
  destroyDatabase: () => undefined,
}));

// eslint-disable-next-line import/first
import { useWorkoutStore } from '@/stores/workoutStore';

const flush = () => new Promise((r) => setTimeout(r, 20));

describe('workoutStore', () => {
  beforeEach(async () => {
    mockDb = await createTestDb();
    await seedDatabase(mockDb);
    await routineRepo.activateRoutine(mockDb, 'rt_full_body', '2026-10-01T08:00:00.000Z');
    useWorkoutStore.getState().clear();
  });

  it('persists every mutation and survives a restart', async () => {
    const store = useWorkoutStore.getState();
    const id = await store.start('tp_full_body_a', 'ready');
    let s = useWorkoutStore.getState();
    expect(s.session?.id).toBe(id);
    expect(s.exercises).toHaveLength(4);

    const squat = s.exercises[0]!;
    const set1 = squat.sets[0]!;
    s.updateSet(squat.id, set1.id, { weight: 135, weightUnit: 'lb', actualReps: 10 });
    s.toggleSetComplete(squat.id, set1.id);
    s.addSet(squat.id);
    s.startRest(squat.id, 90);
    s.setExerciseNotes(squat.id, 'felt good');
    await store.flush();
    await flush();

    // "Restart": wipe memory, hydrate from the database.
    useWorkoutStore.setState({ session: null, exercises: [], restTimer: null, hydrated: false });
    await useWorkoutStore.getState().hydrate();
    s = useWorkoutStore.getState();
    expect(s.session?.id).toBe(id);
    const squatAfter = s.exercises[0]!;
    expect(squatAfter.sets).toHaveLength(4);
    expect(squatAfter.sets[0]).toMatchObject({ weight: 135, actualReps: 10, completed: 1 });
    expect(squatAfter.notes).toBe('felt good');
    expect(s.restTimer?.sessionExerciseId).toBe(squat.id);
    expect(s.restTimer?.durationSeconds).toBe(90);

    // remove the extra set, skip an exercise, finish
    s.removeSet(squatAfter.id, squatAfter.sets[3]!.id);
    s.skipExercise(s.exercises[3]!.id);
    await flush();
    const summary = await useWorkoutStore.getState().finish();
    expect(summary.setsCompleted).toBe(1);
    expect(summary.exercisesCompleted).toBe(1);
    expect(summary.exercisesSkipped).toBe(3);
    expect(useWorkoutStore.getState().session).toBeNull();

    const [row] = await mockDb.select().from(workoutSessions).where(eq(workoutSessions.id, id));
    expect(row?.status).toBe('completed');
    expect(row?.restEndsAt).toBeNull();
    const sets = await mockDb.select().from(exerciseSets);
    expect(sets.filter((x) => x.sessionExerciseId === squat.id)).toHaveLength(3);
  });

  it('abandon marks the session and clears state', async () => {
    const store = useWorkoutStore.getState();
    const id = await store.start('tp_full_body_b', null);
    await useWorkoutStore.getState().abandon();
    const [row] = await mockDb.select().from(workoutSessions).where(eq(workoutSessions.id, id));
    expect(row?.status).toBe('abandoned');
    expect(useWorkoutStore.getState().session).toBeNull();
    await useWorkoutStore.getState().hydrate();
    expect(useWorkoutStore.getState().session).toBeNull();
  });
});

import { and, asc, count, desc, eq, gte, inArray, lte, ne, sql } from 'drizzle-orm';
import {
  exerciseSets,
  exercises,
  recommendationHistory,
  sessionExercises,
  workoutSessions,
  type ExerciseRow,
  type ExerciseSetRow,
  type NewExerciseSetRow,
  type NewRecommendationHistoryRow,
  type NewSessionExerciseRow,
  type NewWorkoutSessionRow,
  type RecommendationHistoryRow,
  type SessionExerciseRow,
  type WorkoutSessionRow,
} from '../schema';
import type { DbOrTx } from '../types';

export interface SessionExerciseDetail extends SessionExerciseRow {
  exercise: ExerciseRow;
  sets: ExerciseSetRow[];
}

export interface SessionDetail extends WorkoutSessionRow {
  exercises: SessionExerciseDetail[];
}

export async function insertSession(db: DbOrTx, row: NewWorkoutSessionRow): Promise<void> {
  await db.insert(workoutSessions).values(row);
}

export async function updateSession(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<NewWorkoutSessionRow, 'id'>>,
): Promise<void> {
  await db.update(workoutSessions).set(patch).where(eq(workoutSessions.id, id));
}

export async function deleteSession(db: DbOrTx, id: string): Promise<void> {
  await db.delete(workoutSessions).where(eq(workoutSessions.id, id));
}

export async function getSession(db: DbOrTx, id: string): Promise<WorkoutSessionRow | null> {
  const rows = await db.select().from(workoutSessions).where(eq(workoutSessions.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getSessionDetail(db: DbOrTx, id: string): Promise<SessionDetail | null> {
  const session = await getSession(db, id);
  if (!session) return null;
  const exRows = await db
    .select({ se: sessionExercises, ex: exercises })
    .from(sessionExercises)
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(eq(sessionExercises.sessionId, id))
    .orderBy(asc(sessionExercises.position));
  const seIds = exRows.map((r) => r.se.id);
  const sets = seIds.length
    ? await db
        .select()
        .from(exerciseSets)
        .where(inArray(exerciseSets.sessionExerciseId, seIds))
        .orderBy(asc(exerciseSets.setNumber))
    : [];
  return {
    ...session,
    exercises: exRows.map((r) => ({
      ...r.se,
      exercise: r.ex,
      sets: sets.filter((s) => s.sessionExerciseId === r.se.id),
    })),
  };
}

export async function findInProgressSessions(db: DbOrTx): Promise<WorkoutSessionRow[]> {
  return db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.status, 'in_progress'))
    .orderBy(desc(workoutSessions.startedAt));
}

export async function getLastCompletedSession(db: DbOrTx): Promise<WorkoutSessionRow | null> {
  const rows = await db
    .select()
    .from(workoutSessions)
    .where(eq(workoutSessions.status, 'completed'))
    .orderBy(desc(workoutSessions.completedAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function listCompletedSessionsSince(db: DbOrTx, sinceIso: string): Promise<WorkoutSessionRow[]> {
  return db
    .select()
    .from(workoutSessions)
    .where(and(eq(workoutSessions.status, 'completed'), gte(workoutSessions.startedAt, sinceIso)))
    .orderBy(desc(workoutSessions.startedAt));
}

export async function listSessions(
  db: DbOrTx,
  opts: { limit?: number; offset?: number; fromLocalDate?: string; toLocalDate?: string; status?: string } = {},
): Promise<WorkoutSessionRow[]> {
  const conds = [ne(workoutSessions.status, 'in_progress')];
  if (opts.status) conds.push(eq(workoutSessions.status, opts.status));
  if (opts.fromLocalDate) conds.push(gte(workoutSessions.localDate, opts.fromLocalDate));
  if (opts.toLocalDate) conds.push(lte(workoutSessions.localDate, opts.toLocalDate));
  return db
    .select()
    .from(workoutSessions)
    .where(and(...conds))
    .orderBy(desc(workoutSessions.startedAt))
    .limit(opts.limit ?? 50)
    .offset(opts.offset ?? 0);
}

export async function countCompletedSessions(db: DbOrTx): Promise<number> {
  const rows = await db
    .select({ n: count() })
    .from(workoutSessions)
    .where(eq(workoutSessions.status, 'completed'));
  return rows[0]?.n ?? 0;
}

export async function insertSessionExercise(db: DbOrTx, row: NewSessionExerciseRow): Promise<void> {
  await db.insert(sessionExercises).values(row);
}

export async function updateSessionExercise(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<NewSessionExerciseRow, 'id'>>,
): Promise<void> {
  await db.update(sessionExercises).set(patch).where(eq(sessionExercises.id, id));
}

export async function shiftSessionExercisePositions(
  db: DbOrTx,
  sessionId: string,
  fromPosition: number,
): Promise<void> {
  await db
    .update(sessionExercises)
    .set({ position: sql`${sessionExercises.position} + 1` })
    .where(and(eq(sessionExercises.sessionId, sessionId), gte(sessionExercises.position, fromPosition)));
}

export async function insertSet(db: DbOrTx, row: NewExerciseSetRow): Promise<void> {
  await db.insert(exerciseSets).values(row);
}

export async function insertSets(db: DbOrTx, rows: NewExerciseSetRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(exerciseSets).values(rows);
}

export async function updateSet(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<NewExerciseSetRow, 'id'>>,
): Promise<void> {
  await db.update(exerciseSets).set(patch).where(eq(exerciseSets.id, id));
}

export async function deleteSet(db: DbOrTx, id: string): Promise<void> {
  await db.delete(exerciseSets).where(eq(exerciseSets.id, id));
}

export async function getSetsForSessionExercise(db: DbOrTx, sessionExerciseId: string): Promise<ExerciseSetRow[]> {
  return db
    .select()
    .from(exerciseSets)
    .where(eq(exerciseSets.sessionExerciseId, sessionExerciseId))
    .orderBy(asc(exerciseSets.setNumber));
}

export interface ExercisePerformance {
  sessionId: string;
  sessionExerciseId: string;
  startedAt: string;
  completedAt: string | null;
  localDate: string;
  sets: ExerciseSetRow[];
}

/**
 * Most recent completed performances of an exercise (newest first).
 * Only sessions with status completed and session_exercises with status completed count.
 */
export async function getExerciseHistory(
  db: DbOrTx,
  exerciseId: string,
  limit = 2,
  excludeSessionId?: string,
): Promise<ExercisePerformance[]> {
  const conds = [
    eq(sessionExercises.exerciseId, exerciseId),
    eq(sessionExercises.status, 'completed'),
    eq(workoutSessions.status, 'completed'),
  ];
  if (excludeSessionId) conds.push(ne(workoutSessions.id, excludeSessionId));
  const rows = await db
    .select({
      sessionId: workoutSessions.id,
      sessionExerciseId: sessionExercises.id,
      startedAt: workoutSessions.startedAt,
      completedAt: workoutSessions.completedAt,
      localDate: workoutSessions.localDate,
    })
    .from(sessionExercises)
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionExercises.sessionId))
    .where(and(...conds))
    .orderBy(desc(workoutSessions.completedAt))
    .limit(limit);
  if (rows.length === 0) return [];
  const sets = await db
    .select()
    .from(exerciseSets)
    .where(
      inArray(
        exerciseSets.sessionExerciseId,
        rows.map((r) => r.sessionExerciseId),
      ),
    )
    .orderBy(asc(exerciseSets.setNumber));
  return rows.map((r) => ({ ...r, sets: sets.filter((s) => s.sessionExerciseId === r.sessionExerciseId) }));
}

/** All completed sets for an exercise across history (oldest first) — for charts and PRs. */
export async function getAllCompletedSetsForExercise(
  db: DbOrTx,
  exerciseId: string,
): Promise<(ExerciseSetRow & { localDate: string; sessionId: string })[]> {
  const rows = await db
    .select({ set: exerciseSets, localDate: workoutSessions.localDate, sessionId: workoutSessions.id })
    .from(exerciseSets)
    .innerJoin(sessionExercises, eq(sessionExercises.id, exerciseSets.sessionExerciseId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionExercises.sessionId))
    .where(
      and(
        eq(sessionExercises.exerciseId, exerciseId),
        eq(exerciseSets.completed, 1),
        eq(exerciseSets.setType, 'working'),
        eq(workoutSessions.status, 'completed'),
      ),
    )
    .orderBy(asc(workoutSessions.startedAt), asc(exerciseSets.setNumber));
  return rows.map((r) => ({ ...r.set, localDate: r.localDate, sessionId: r.sessionId }));
}

/** Exercises the user has actually trained, with counts, for progress pickers. */
export async function listTrainedExercises(
  db: DbOrTx,
): Promise<{ exercise: ExerciseRow; sessions: number; lastDate: string }[]> {
  const rows = await db
    .select({
      exercise: exercises,
      sessions: count(sessionExercises.id),
      lastDate: sql<string>`max(${workoutSessions.localDate})`,
    })
    .from(sessionExercises)
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionExercises.sessionId))
    .where(and(eq(workoutSessions.status, 'completed'), eq(sessionExercises.status, 'completed')))
    .groupBy(exercises.id)
    .orderBy(desc(sql`max(${workoutSessions.localDate})`));
  return rows;
}

export async function insertRecommendations(db: DbOrTx, rows: NewRecommendationHistoryRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(recommendationHistory).values(rows);
}

export async function getLatestRecommendation(
  db: DbOrTx,
  exerciseId: string,
): Promise<RecommendationHistoryRow | null> {
  const rows = await db
    .select()
    .from(recommendationHistory)
    .where(eq(recommendationHistory.exerciseId, exerciseId))
    .orderBy(desc(recommendationHistory.createdAt))
    .limit(1);
  return rows[0] ?? null;
}

export async function getRecommendationsForSession(
  db: DbOrTx,
  sessionId: string,
): Promise<RecommendationHistoryRow[]> {
  return db.select().from(recommendationHistory).where(eq(recommendationHistory.sessionId, sessionId));
}

/** Rows for volume/frequency analytics over a date range: all completed working sets with exercise info. */
export async function getCompletedSetsBetween(
  db: DbOrTx,
  fromLocalDate: string,
  toLocalDate: string,
): Promise<
  {
    sessionId: string;
    localDate: string;
    exerciseId: string;
    muscleGroup: string;
    weight: number | null;
    weightUnit: string | null;
    actualReps: number | null;
    durationSeconds: number | null;
  }[]
> {
  return db
    .select({
      sessionId: workoutSessions.id,
      localDate: workoutSessions.localDate,
      exerciseId: sessionExercises.exerciseId,
      muscleGroup: exercises.primaryMuscleGroup,
      weight: exerciseSets.weight,
      weightUnit: exerciseSets.weightUnit,
      actualReps: exerciseSets.actualReps,
      durationSeconds: exerciseSets.durationSeconds,
    })
    .from(exerciseSets)
    .innerJoin(sessionExercises, eq(sessionExercises.id, exerciseSets.sessionExerciseId))
    .innerJoin(workoutSessions, eq(workoutSessions.id, sessionExercises.sessionId))
    .innerJoin(exercises, eq(exercises.id, sessionExercises.exerciseId))
    .where(
      and(
        eq(workoutSessions.status, 'completed'),
        eq(exerciseSets.completed, 1),
        eq(exerciseSets.setType, 'working'),
        gte(workoutSessions.localDate, fromLocalDate),
        lte(workoutSessions.localDate, toLocalDate),
      ),
    );
}

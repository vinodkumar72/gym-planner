import { and, asc, eq, inArray, like } from 'drizzle-orm';
import { exercises, type ExerciseRow, type NewExerciseRow } from '../schema';
import type { DbOrTx } from '../types';

export interface ExerciseFilter {
  search?: string;
  muscleGroup?: string;
  equipment?: string;
  includeArchived?: boolean;
}

export async function listExercises(db: DbOrTx, filter: ExerciseFilter = {}): Promise<ExerciseRow[]> {
  const conds = [];
  if (!filter.includeArchived) conds.push(eq(exercises.isArchived, 0));
  if (filter.muscleGroup) conds.push(eq(exercises.primaryMuscleGroup, filter.muscleGroup));
  if (filter.equipment) conds.push(eq(exercises.equipment, filter.equipment));
  if (filter.search && filter.search.trim()) conds.push(like(exercises.name, `%${filter.search.trim()}%`));
  return db
    .select()
    .from(exercises)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(exercises.name));
}

export async function getExercise(db: DbOrTx, id: string): Promise<ExerciseRow | null> {
  const rows = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getExercises(db: DbOrTx, ids: string[]): Promise<Map<string, ExerciseRow>> {
  if (ids.length === 0) return new Map();
  const rows = await db.select().from(exercises).where(inArray(exercises.id, ids));
  return new Map(rows.map((r) => [r.id, r]));
}

export async function insertExercise(db: DbOrTx, row: NewExerciseRow): Promise<void> {
  await db.insert(exercises).values(row);
}

export async function updateExercise(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<NewExerciseRow, 'id'>>,
): Promise<void> {
  await db.update(exercises).set(patch).where(eq(exercises.id, id));
}

export async function setExerciseArchived(db: DbOrTx, id: string, archived: boolean, now: string): Promise<void> {
  await db
    .update(exercises)
    .set({ isArchived: archived ? 1 : 0, updatedAt: now })
    .where(eq(exercises.id, id));
}

/** Hard delete only succeeds when nothing references the exercise (FK restrict). */
export async function deleteExercise(db: DbOrTx, id: string): Promise<void> {
  await db.delete(exercises).where(eq(exercises.id, id));
}

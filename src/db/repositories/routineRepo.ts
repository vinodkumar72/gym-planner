import { and, asc, eq, inArray, ne } from 'drizzle-orm';
import {
  exercises,
  routineSchedule,
  routines,
  templateExercises,
  workoutTemplates,
  type ExerciseRow,
  type NewRoutineRow,
  type NewTemplateExerciseRow,
  type NewWorkoutTemplateRow,
  type RoutineRow,
  type RoutineScheduleRow,
  type TemplateExerciseRow,
  type WorkoutTemplateRow,
} from '../schema';
import type { Db, DbOrTx } from '../types';

export interface TemplateExerciseDetail extends TemplateExerciseRow {
  exercise: ExerciseRow;
}

export interface TemplateDetail extends WorkoutTemplateRow {
  exercises: TemplateExerciseDetail[];
}

export interface RoutineDetail extends RoutineRow {
  templates: TemplateDetail[];
  schedule: RoutineScheduleRow[];
}

export async function listRoutines(db: DbOrTx, includeArchived = false): Promise<RoutineRow[]> {
  return db
    .select()
    .from(routines)
    .where(includeArchived ? undefined : eq(routines.isArchived, 0))
    .orderBy(asc(routines.isBuiltin), asc(routines.name));
}

export async function getRoutine(db: DbOrTx, id: string): Promise<RoutineRow | null> {
  const rows = await db.select().from(routines).where(eq(routines.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getActiveRoutine(db: DbOrTx): Promise<RoutineRow | null> {
  const rows = await db
    .select()
    .from(routines)
    .where(and(eq(routines.isActive, 1), eq(routines.isArchived, 0)))
    .limit(1);
  return rows[0] ?? null;
}

export async function getTemplatesForRoutine(db: DbOrTx, routineId: string): Promise<WorkoutTemplateRow[]> {
  return db
    .select()
    .from(workoutTemplates)
    .where(eq(workoutTemplates.routineId, routineId))
    .orderBy(asc(workoutTemplates.position));
}

export async function getTemplate(db: DbOrTx, templateId: string): Promise<WorkoutTemplateRow | null> {
  const rows = await db.select().from(workoutTemplates).where(eq(workoutTemplates.id, templateId)).limit(1);
  return rows[0] ?? null;
}

export async function getTemplateDetail(db: DbOrTx, templateId: string): Promise<TemplateDetail | null> {
  const t = await getTemplate(db, templateId);
  if (!t) return null;
  const rows = await db
    .select({ te: templateExercises, ex: exercises })
    .from(templateExercises)
    .innerJoin(exercises, eq(exercises.id, templateExercises.exerciseId))
    .where(eq(templateExercises.templateId, templateId))
    .orderBy(asc(templateExercises.position));
  return { ...t, exercises: rows.map((r) => ({ ...r.te, exercise: r.ex })) };
}

export async function getRoutineDetail(db: DbOrTx, routineId: string): Promise<RoutineDetail | null> {
  const routine = await getRoutine(db, routineId);
  if (!routine) return null;
  const templates = await getTemplatesForRoutine(db, routineId);
  const ids = templates.map((t) => t.id);
  const teRows = ids.length
    ? await db
        .select({ te: templateExercises, ex: exercises })
        .from(templateExercises)
        .innerJoin(exercises, eq(exercises.id, templateExercises.exerciseId))
        .where(inArray(templateExercises.templateId, ids))
        .orderBy(asc(templateExercises.position))
    : [];
  const schedule = await db.select().from(routineSchedule).where(eq(routineSchedule.routineId, routineId));
  return {
    ...routine,
    templates: templates.map((t) => ({
      ...t,
      exercises: teRows.filter((r) => r.te.templateId === t.id).map((r) => ({ ...r.te, exercise: r.ex })),
    })),
    schedule,
  };
}

export async function insertRoutine(db: DbOrTx, row: NewRoutineRow): Promise<void> {
  await db.insert(routines).values(row);
}

export async function updateRoutine(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<NewRoutineRow, 'id'>>,
): Promise<void> {
  await db.update(routines).set(patch).where(eq(routines.id, id));
}

/** Exactly one routine is active at a time. */
export async function activateRoutine(db: Db, id: string, now: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(routines).set({ isActive: 0, updatedAt: now }).where(ne(routines.id, id));
    await tx
      .update(routines)
      .set({ isActive: 1, isArchived: 0, activatedAt: now, updatedAt: now })
      .where(eq(routines.id, id));
  });
}

export async function insertTemplate(db: DbOrTx, row: NewWorkoutTemplateRow): Promise<void> {
  await db.insert(workoutTemplates).values(row);
}

export async function updateTemplate(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<NewWorkoutTemplateRow, 'id'>>,
): Promise<void> {
  await db.update(workoutTemplates).set(patch).where(eq(workoutTemplates.id, id));
}

export async function deleteTemplate(db: DbOrTx, id: string): Promise<void> {
  await db.delete(workoutTemplates).where(eq(workoutTemplates.id, id));
}

export async function reorderTemplates(db: DbOrTx, orderedIds: string[], now: string): Promise<void> {
  for (const [i, id] of orderedIds.entries()) {
    await db.update(workoutTemplates).set({ position: i, updatedAt: now }).where(eq(workoutTemplates.id, id));
  }
}

export async function insertTemplateExercise(db: DbOrTx, row: NewTemplateExerciseRow): Promise<void> {
  await db.insert(templateExercises).values(row);
}

export async function updateTemplateExercise(
  db: DbOrTx,
  id: string,
  patch: Partial<Omit<NewTemplateExerciseRow, 'id'>>,
): Promise<void> {
  await db.update(templateExercises).set(patch).where(eq(templateExercises.id, id));
}

export async function deleteTemplateExercise(db: DbOrTx, id: string): Promise<void> {
  await db.delete(templateExercises).where(eq(templateExercises.id, id));
}

export async function reorderTemplateExercises(db: DbOrTx, orderedIds: string[], now: string): Promise<void> {
  for (const [i, id] of orderedIds.entries()) {
    await db.update(templateExercises).set({ position: i, updatedAt: now }).where(eq(templateExercises.id, id));
  }
}

export async function getTemplateExercise(db: DbOrTx, id: string): Promise<TemplateExerciseRow | null> {
  const rows = await db.select().from(templateExercises).where(eq(templateExercises.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function getScheduleForRoutine(db: DbOrTx, routineId: string): Promise<RoutineScheduleRow[]> {
  return db.select().from(routineSchedule).where(eq(routineSchedule.routineId, routineId));
}

export async function setScheduleDay(
  db: DbOrTx,
  routineId: string,
  dayOfWeek: number,
  templateId: string | null,
  idFactory: () => string,
): Promise<void> {
  await db
    .delete(routineSchedule)
    .where(and(eq(routineSchedule.routineId, routineId), eq(routineSchedule.dayOfWeek, dayOfWeek)));
  if (templateId) {
    await db.insert(routineSchedule).values({ id: idFactory(), routineId, dayOfWeek, templateId });
  }
}

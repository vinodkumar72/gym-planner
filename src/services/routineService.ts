import type { Db } from '@/db/types';
import * as routineRepo from '@/db/repositories/routineRepo';
import { getExercise } from '@/db/repositories/exerciseRepo';
import type { ExerciseRow } from '@/db/schema';
import type { RotationType, WeightUnit } from '@/domain/models/types';

export interface CreateRoutineInput {
  name: string;
  description?: string;
  rotationType: RotationType;
  idFactory: () => string;
  now?: string;
}

export async function createRoutine(db: Db, input: CreateRoutineInput): Promise<string> {
  const now = input.now ?? new Date().toISOString();
  const id = input.idFactory();
  await routineRepo.insertRoutine(db, {
    id,
    name: input.name.trim() || 'My Routine',
    description: input.description ?? null,
    rotationType: input.rotationType,
    isActive: 0,
    isBuiltin: 0,
    isArchived: 0,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function addTemplate(
  db: Db,
  routineId: string,
  name: string,
  idFactory: () => string,
  now = new Date().toISOString(),
): Promise<string> {
  const existing = await routineRepo.getTemplatesForRoutine(db, routineId);
  const id = idFactory();
  await routineRepo.insertTemplate(db, {
    id,
    routineId,
    name: name.trim() || `Workout ${existing.length + 1}`,
    position: existing.length,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export function defaultTargetsFor(exercise: ExerciseRow, unit: WeightUnit) {
  const isTimed = exercise.exerciseType === 'duration';
  const isCardio = exercise.exerciseType === 'cardio';
  return {
    targetSets: isCardio ? 1 : 3,
    minReps: isTimed || isCardio ? 0 : 8,
    maxReps: isTimed || isCardio ? 0 : 12,
    restSeconds: isCardio ? 0 : 90,
    progressionIncrement: exercise.isBodyweight
      ? 1
      : isTimed
        ? 10
        : unit === 'kg'
          ? exercise.defaultIncrementKg
          : exercise.defaultIncrementLb,
    incrementUnit: unit,
    targetDurationSeconds: isTimed ? 30 : isCardio ? 1200 : null,
    targetDistance: null,
  };
}

export async function addTemplateExercise(
  db: Db,
  templateId: string,
  exerciseId: string,
  unit: WeightUnit,
  idFactory: () => string,
  now = new Date().toISOString(),
): Promise<string> {
  const exercise = await getExercise(db, exerciseId);
  if (!exercise) throw new Error('Exercise not found');
  const detail = await routineRepo.getTemplateDetail(db, templateId);
  if (!detail) throw new Error('Template not found');
  const id = idFactory();
  await routineRepo.insertTemplateExercise(db, {
    id,
    templateId,
    exerciseId,
    position: detail.exercises.length,
    ...defaultTargetsFor(exercise, unit),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

/** Deep copy of a routine (templates, exercises, schedule) as a new editable custom routine. */
export async function duplicateRoutine(
  db: Db,
  routineId: string,
  idFactory: () => string,
  now = new Date().toISOString(),
): Promise<string> {
  const source = await routineRepo.getRoutineDetail(db, routineId);
  if (!source) throw new Error('Routine not found');
  const newId = idFactory();
  await db.transaction(async (tx) => {
    await routineRepo.insertRoutine(tx, {
      id: newId,
      name: `${source.name} (copy)`,
      description: source.description,
      rotationType: source.rotationType,
      isActive: 0,
      isBuiltin: 0,
      isArchived: 0,
      sourceRoutineId: source.id,
      createdAt: now,
      updatedAt: now,
    });
    const templateMap = new Map<string, string>();
    for (const t of source.templates) {
      const tid = idFactory();
      templateMap.set(t.id, tid);
      await routineRepo.insertTemplate(tx, {
        id: tid,
        routineId: newId,
        name: t.name,
        position: t.position,
        createdAt: now,
        updatedAt: now,
      });
      for (const te of t.exercises) {
        await routineRepo.insertTemplateExercise(tx, {
          id: idFactory(),
          templateId: tid,
          exerciseId: te.exerciseId,
          position: te.position,
          targetSets: te.targetSets,
          minReps: te.minReps,
          maxReps: te.maxReps,
          restSeconds: te.restSeconds,
          progressionIncrement: te.progressionIncrement,
          incrementUnit: te.incrementUnit,
          targetDurationSeconds: te.targetDurationSeconds,
          targetDistance: te.targetDistance,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
    for (const s of source.schedule) {
      const tid = templateMap.get(s.templateId);
      if (tid) await routineRepo.setScheduleDay(tx, newId, s.dayOfWeek, tid, idFactory);
    }
  });
  return newId;
}

export async function archiveRoutine(db: Db, routineId: string, now = new Date().toISOString()): Promise<void> {
  await routineRepo.updateRoutine(db, routineId, { isArchived: 1, isActive: 0, updatedAt: now });
}

export async function unarchiveRoutine(db: Db, routineId: string, now = new Date().toISOString()): Promise<void> {
  await routineRepo.updateRoutine(db, routineId, { isArchived: 0, updatedAt: now });
}

/** Deleting a routine keeps sessions (FK set null) because history is never deleted automatically. */
export async function deleteRoutine(db: Db, routineId: string): Promise<void> {
  const r = await routineRepo.getRoutine(db, routineId);
  if (!r) return;
  if (r.isBuiltin) throw new Error('Built-in routines can be archived but not deleted');
  await db.transaction(async (tx) => {
    const { routines } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await tx.delete(routines).where(eq(routines.id, routineId));
  });
}

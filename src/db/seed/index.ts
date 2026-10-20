import { and, eq, like } from 'drizzle-orm';
import { appMeta, exercises, routines, templateExercises, workoutTemplates } from '../schema';
import type { Db, Tx } from '../types';
import { SEED_EXERCISES } from './exercises';
import { SEED_ROUTINES } from './routines';

/** Bump when built-in data changes; `upgradeSeed` applies targeted, non-destructive fixes for older versions. */
export const SEED_VERSION = 2;
const SEED_KEY = 'seed_version';

/**
 * Idempotent seed: inserts built-in exercises and routines that are missing. Existing rows (possibly
 * edited by the user) are left untouched. Safe to run on every launch; cheap after the first run.
 */
export async function seedDatabase(db: Db, now: string = new Date().toISOString()): Promise<void> {
  const existing = await db.select().from(appMeta).where(eq(appMeta.key, SEED_KEY));
  const version = existing[0] ? Number(existing[0].value) : 0;
  if (version >= SEED_VERSION) return;

  await db.transaction(async (tx) => {
    for (const e of SEED_EXERCISES) {
      await tx
        .insert(exercises)
        .values({
          id: e.id,
          name: e.name,
          primaryMuscleGroup: e.primary,
          secondaryMuscleGroups: JSON.stringify(e.secondary),
          equipment: e.equipment,
          exerciseType: e.type,
          isBodyweight: e.bodyweight ? 1 : 0,
          instructions: e.instructions ?? null,
          minLoad: e.minLoadLb ?? null,
          minLoadUnit: e.minLoadLb !== undefined ? 'lb' : null,
          defaultIncrementLb: e.incLb ?? 5,
          defaultIncrementKg: e.incKg ?? 2.5,
          isCustom: 0,
          isArchived: 0,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();
    }

    for (const r of SEED_ROUTINES) {
      await tx
        .insert(routines)
        .values({
          id: r.id,
          name: r.name,
          description: r.description,
          rotationType: r.rotationType,
          isActive: 0,
          isBuiltin: 1,
          isArchived: 0,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing();

      for (const [ti, t] of r.templates.entries()) {
        await tx
          .insert(workoutTemplates)
          .values({ id: t.id, routineId: r.id, name: t.name, position: ti, createdAt: now, updatedAt: now })
          .onConflictDoNothing();

        for (const [ei, te] of t.exercises.entries()) {
          const seed = SEED_EXERCISES.find((x) => x.id === te.exerciseId);
          const incLb = seed?.incLb ?? 5;
          const isTimed = seed?.type === 'duration';
          const isCardio = seed?.type === 'cardio';
          await tx
            .insert(templateExercises)
            .values({
              id: `${t.id}__${te.exerciseId}`,
              templateId: t.id,
              exerciseId: te.exerciseId,
              position: ei,
              targetSets: te.sets ?? 3,
              minReps: te.minReps ?? 8,
              maxReps: te.maxReps ?? 12,
              restSeconds: te.rest ?? 90,
              progressionIncrement: seed?.bodyweight ? 1 : isTimed ? 10 : incLb,
              incrementUnit: 'lb',
              targetDurationSeconds: isTimed || isCardio ? (te.durationSeconds ?? null) : null,
              targetDistance: isCardio ? (te.distance ?? null) : null,
              createdAt: now,
              updatedAt: now,
            })
            .onConflictDoNothing();
        }
      }
    }

    await upgradeSeed(tx, version);

    await tx
      .insert(appMeta)
      .values({ key: SEED_KEY, value: String(SEED_VERSION) })
      .onConflictDoUpdate({ target: appMeta.key, set: { value: String(SEED_VERSION) } });
  });
}

/**
 * Fixes for data seeded by earlier versions. Only rows that still hold the old seed defaults are touched,
 * so anything the user customised is preserved.
 */
async function upgradeSeed(tx: Tx, fromVersion: number): Promise<void> {
  if (fromVersion < 2 && fromVersion > 0) {
    // v1 seeded light dumbbell/cable exercises with 2.5 lb steps; real gyms mostly move in 5 lb / 2.5 kg.
    await tx
      .update(exercises)
      .set({ defaultIncrementLb: 5, defaultIncrementKg: 2.5 })
      .where(and(eq(exercises.isCustom, 0), eq(exercises.defaultIncrementLb, 2.5)));
    await tx
      .update(templateExercises)
      .set({ progressionIncrement: 5 })
      .where(
        and(
          // seeded template-exercise ids look like "tp_ppl_push__ex_bench_press"
          like(templateExercises.id, 'tp_%__ex_%'),
          eq(templateExercises.progressionIncrement, 2.5),
          eq(templateExercises.incrementUnit, 'lb'),
        ),
      );
  }
}

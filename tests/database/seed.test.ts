import { count, sql } from 'drizzle-orm';
import { exercises, routines, templateExercises, workoutTemplates } from '@/db/schema';
import { seedDatabase } from '@/db/seed';
import { SEED_EXERCISES } from '@/db/seed/exercises';
import { MUSCLE_GROUPS } from '@/domain/models/types';
import { createTestDb } from '../helpers/testDb';

describe('seed', () => {
  it('inserts at least 75 exercises covering every muscle group and four routines', async () => {
    const db = await createTestDb();
    await seedDatabase(db);
    const [ex] = await db.select({ n: count() }).from(exercises);
    expect(ex?.n).toBeGreaterThanOrEqual(75);
    const groups = new Set(SEED_EXERCISES.map((e) => e.primary));
    for (const g of MUSCLE_GROUPS) expect(groups.has(g)).toBe(true);
    const [rt] = await db.select({ n: count() }).from(routines);
    expect(rt?.n).toBe(4);
    const [tp] = await db.select({ n: count() }).from(workoutTemplates);
    expect(tp?.n).toBe(13);
    const [te] = await db.select({ n: count() }).from(templateExercises);
    expect(te?.n).toBeGreaterThan(30);
  });

  it('seed exercise ids are unique and every template exercise references a seeded exercise', () => {
    const ids = new Set<string>();
    for (const e of SEED_EXERCISES) {
      expect(ids.has(e.id)).toBe(false);
      ids.add(e.id);
    }
  });

  it('seeds gym-realistic increments and upgrades v1 data without touching custom values', async () => {
    const db = await createTestDb();
    // simulate a v1 install: seed, then rewrite the old 2.5 lb defaults and the old version marker
    await seedDatabase(db);
    await db.run(
      sql`UPDATE exercises SET default_increment_lb = 2.5, default_increment_kg = 1.25 WHERE id IN ('ex_bicep_curl', 'ex_lateral_raise')`,
    );
    await db.run(
      sql`UPDATE template_exercises SET progression_increment = 2.5 WHERE id = 'tp_ppl_pull__ex_bicep_curl'`,
    );
    await db.run(
      sql`UPDATE template_exercises SET progression_increment = 2.5 WHERE id = 'tp_ppl_push__ex_tricep_pushdown'`,
    );
    await db.run(
      sql`INSERT INTO exercises (id, name, primary_muscle_group, equipment, exercise_type, default_increment_lb, default_increment_kg, is_custom, created_at, updated_at) VALUES ('cx_micro', 'Micro Curl', 'biceps', 'dumbbell', 'strength', 2.5, 1.25, 1, 'now', 'now')`,
    );
    await db.run(sql`UPDATE app_meta SET value = '1' WHERE key = 'seed_version'`);

    await seedDatabase(db);
    const rows = (await db.all(
      sql`SELECT id, default_increment_lb AS lb FROM exercises WHERE id IN ('ex_bicep_curl', 'ex_lateral_raise', 'cx_micro', 'ex_leg_press')`,
    )) as { id: string; lb: number }[];
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.lb]));
    expect(byId.ex_bicep_curl).toBe(5);
    expect(byId.ex_lateral_raise).toBe(5);
    expect(byId.ex_leg_press).toBe(20);
    expect(byId.cx_micro).toBe(2.5); // custom exercise untouched
    const te = (await db.all(
      sql`SELECT id, progression_increment AS inc FROM template_exercises WHERE id IN ('tp_ppl_pull__ex_bicep_curl', 'tp_ppl_push__ex_tricep_pushdown')`,
    )) as { id: string; inc: number }[];
    expect(te.every((t) => t.inc === 5)).toBe(true);
  });

  it('is idempotent', async () => {
    const db = await createTestDb();
    await seedDatabase(db);
    await seedDatabase(db);
    const [ex] = await db.select({ n: count() }).from(exercises);
    expect(ex?.n).toBe(SEED_EXERCISES.length);
  });
});

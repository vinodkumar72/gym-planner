import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'node:path';
import { createTestDb } from '../helpers/testDb';

describe('migrations', () => {
  it('creates every table and enables foreign keys', async () => {
    const db = await createTestDb();
    const rows = (await db.all(sql`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)) as {
      name: string;
    }[];
    const names = rows.map((r) => r.name);
    for (const expected of [
      'exercises',
      'routines',
      'workout_templates',
      'template_exercises',
      'routine_schedule',
      'workout_sessions',
      'session_exercises',
      'exercise_sets',
      'user_preferences',
      'recommendation_history',
      'app_meta',
    ]) {
      expect(names).toContain(expected);
    }
    const fk = (await db.all(sql`PRAGMA foreign_keys`)) as { foreign_keys: number }[];
    expect(fk[0]?.foreign_keys).toBe(1);
  });

  it('is idempotent when applied twice', async () => {
    const db = await createTestDb();
    await expect(
      migrate(db as never, { migrationsFolder: path.resolve(__dirname, '../../drizzle') }),
    ).resolves.toBeUndefined();
  });
});

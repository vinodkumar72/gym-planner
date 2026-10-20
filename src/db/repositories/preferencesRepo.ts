import { eq } from 'drizzle-orm';
import { appMeta, userPreferences, type UserPreferencesRow } from '../schema';
import type { DbOrTx } from '../types';

export const PREFS_ID = 'default';

export async function getPreferences(db: DbOrTx, now: string = new Date().toISOString()): Promise<UserPreferencesRow> {
  const rows = await db.select().from(userPreferences).where(eq(userPreferences.id, PREFS_ID)).limit(1);
  if (rows[0]) return rows[0];
  await db
    .insert(userPreferences)
    .values({ id: PREFS_ID, createdAt: now, updatedAt: now })
    .onConflictDoNothing();
  const again = await db.select().from(userPreferences).where(eq(userPreferences.id, PREFS_ID)).limit(1);
  const row = again[0];
  if (!row) throw new Error('Failed to create default preferences');
  return row;
}

export async function updatePreferences(
  db: DbOrTx,
  patch: Partial<Omit<UserPreferencesRow, 'id' | 'createdAt'>>,
  now: string = new Date().toISOString(),
): Promise<UserPreferencesRow> {
  await getPreferences(db, now);
  await db
    .update(userPreferences)
    .set({ ...patch, updatedAt: now })
    .where(eq(userPreferences.id, PREFS_ID));
  return getPreferences(db, now);
}

export async function getMeta(db: DbOrTx, key: string): Promise<string | null> {
  const rows = await db.select().from(appMeta).where(eq(appMeta.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

export async function setMeta(db: DbOrTx, key: string, value: string): Promise<void> {
  await db
    .insert(appMeta)
    .values({ key, value })
    .onConflictDoUpdate({ target: appMeta.key, set: { value } });
}

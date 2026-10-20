import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { deleteDatabaseSync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { schema } from './schema';
import type { Db } from './types';

export const DATABASE_NAME = 'gym-planner.db';

let sqlite: SQLiteDatabase | null = null;
let expoDb: ExpoSQLiteDatabase<typeof schema> | null = null;
let db: Db | null = null;

export function getSqlite(): SQLiteDatabase {
  if (!sqlite) {
    sqlite = openDatabaseSync(DATABASE_NAME, { enableChangeListener: false });
    sqlite.execSync('PRAGMA foreign_keys = ON;');
    sqlite.execSync('PRAGMA journal_mode = WAL;');
  }
  return sqlite;
}

/** Raw Drizzle handle for the expo driver (needed by `useMigrations`). */
export function getExpoDb(): ExpoSQLiteDatabase<typeof schema> {
  if (!expoDb) expoDb = drizzle(getSqlite(), { schema });
  return expoDb;
}

/** Lazily opened singleton Drizzle handle used by all services and stores. */
export function getDb(): Db {
  if (!db) db = getExpoDb() as unknown as Db;
  return db;
}

/** Test seam: inject a different handle (e.g. in-memory libsql). */
export function setDbForTesting(handle: Db | null): void {
  db = handle;
}

/** Closes and deletes the database file. Used by "Delete all data" after explicit confirmation. */
export function destroyDatabase(): void {
  try {
    sqlite?.closeSync();
  } finally {
    sqlite = null;
    expoDb = null;
    db = null;
    deleteDatabaseSync(DATABASE_NAME);
  }
}

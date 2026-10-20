import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { migrate } from 'drizzle-orm/libsql/migrator';
import path from 'node:path';
import { schema } from '@/db/schema';
import type { Db } from '@/db/types';

/**
 * Creates a fresh in-memory SQLite database, applies the generated migrations
 * (the same SQL that ships in the app) and returns a Drizzle handle.
 */
export async function createTestDb(): Promise<Db> {
  const client = createClient({ url: ':memory:' });
  await client.execute('PRAGMA foreign_keys = ON');
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.resolve(__dirname, '../../drizzle') });
  return db as unknown as Db;
}

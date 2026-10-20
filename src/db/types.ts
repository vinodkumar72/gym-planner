import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import type { ExtractTablesWithRelations } from 'drizzle-orm';
import type { schema } from './schema';

/**
 * Database handle type shared by the app (expo-sqlite driver) and tests (libsql driver).
 * Both drivers are async, so repositories written against this type work in both.
 */
export type Db = BaseSQLiteDatabase<'async', any, typeof schema, ExtractTablesWithRelations<typeof schema>>;

/** Transaction handle — same surface as Db for our purposes. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export type DbOrTx = Db | Tx;

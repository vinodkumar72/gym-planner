import { count } from 'drizzle-orm';
import { exerciseSets, exercises, workoutSessions } from '@/db/schema';
import * as routineRepo from '@/db/repositories/routineRepo';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { seedDatabase } from '@/db/seed';
import { backupToCsv, buildBackup, CURRENT_SCHEMA_VERSION, parseBackup, restoreBackup, serializeBackup } from '@/services/backup/core';
import { decryptEnvelope, encryptText, isEncryptedEnvelope } from '@/services/backup/crypto';
import { finishWorkout, startWorkout } from '@/services/workoutService';
import { createTestDb } from '../helpers/testDb';

let n = 0;
const idFactory = () => `b-${++n}`;
const random = (len: number) => new Uint8Array(Array.from({ length: len }, (_, i) => (i * 37 + 11) % 256));

async function populated() {
  const db = await createTestDb();
  await seedDatabase(db);
  await routineRepo.activateRoutine(db, 'rt_ppl', '2026-10-01T08:00:00.000Z');
  const id = await startWorkout(db, { templateId: 'tp_ppl_push', readiness: 'ready', now: new Date(2026, 9, 5, 10), idFactory });
  const detail = await sessionRepo.getSessionDetail(db, id);
  for (const e of detail?.exercises ?? []) {
    for (const s of e.sets) await sessionRepo.updateSet(db, s.id, { actualReps: 10, weight: 100, weightUnit: 'lb', completed: 1 });
  }
  await finishWorkout(db, id, idFactory, new Date(2026, 9, 5, 11));
  return db;
}

describe('backup', () => {
  it('round-trips through export → parse → restore', async () => {
    const src = await populated();
    const backup = await buildBackup(src, '1.0.0', '2026-10-06T00:00:00.000Z');
    expect(backup.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    const text = serializeBackup(backup);
    const parsed = parseBackup(text);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.preview.completedSessions).toBe(1);
    expect(parsed.preview.counts.exercise_sets).toBe(12);
    expect(parsed.preview.dateRange).toEqual({ from: '2026-10-05', to: '2026-10-05' });

    const dst = await createTestDb();
    await seedDatabase(dst);
    await restoreBackup(dst, parsed.backup);
    const [s] = await dst.select({ n: count() }).from(workoutSessions);
    expect(s?.n).toBe(1);
    const [sets] = await dst.select({ n: count() }).from(exerciseSets);
    expect(sets?.n).toBe(12);
    const [ex] = await dst.select({ n: count() }).from(exercises);
    expect(ex?.n).toBe(backup.tables.exercises.length);
    const active = await routineRepo.getActiveRoutine(dst);
    expect(active?.id).toBe('rt_ppl');
    const again = await buildBackup(dst, '1.0.0', '2026-10-06T00:00:00.000Z');
    expect(again.tables).toEqual(backup.tables);
  });

  it('rejects invalid, foreign and newer backups with clear messages', () => {
    expect(parseBackup('not json')).toMatchObject({ ok: false, error: expect.stringMatching(/not valid JSON/) });
    expect(parseBackup('{"hello":1}')).toMatchObject({ ok: false, error: expect.stringMatching(/not a Gym Planner backup/) });
    expect(parseBackup(JSON.stringify({ format: 'gym-planner-backup', schemaVersion: CURRENT_SCHEMA_VERSION + 5, appVersion: '9', exportedAt: '', tables: {} }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/newer version/),
    });
    expect(parseBackup(JSON.stringify({ format: 'gym-planner-backup', schemaVersion: CURRENT_SCHEMA_VERSION, appVersion: '1', exportedAt: '', tables: { exercises: [{ bogus: true }] } }))).toMatchObject({
      ok: false,
      error: expect.stringMatching(/invalid data/),
    });
  });

  it('restore is transactional: a bad row leaves existing data untouched', async () => {
    const db = await populated();
    const backup = await buildBackup(db, '1.0.0');
    // orphan set referencing a missing session_exercise violates the FK → whole restore rolls back
    backup.tables.exercise_sets.push({ id: 'orphan', sessionExerciseId: 'missing', setNumber: 1 });
    await expect(restoreBackup(db, backup)).rejects.toThrow();
    const [s] = await db.select({ n: count() }).from(workoutSessions);
    expect(s?.n).toBe(1);
    const [sets] = await db.select({ n: count() }).from(exerciseSets);
    expect(sets?.n).toBe(12);
  });

  it('exports CSV with a header and one row per set', async () => {
    const db = await populated();
    const csv = backupToCsv(await buildBackup(db, '1.0.0'));
    const lines = csv.trim().split('\r\n');
    expect(lines[0]?.replace('﻿', '')).toMatch(/^session_id,session_date,/);
    expect(lines).toHaveLength(13);
    expect(lines[1]).toContain('Push Day');
    expect(lines[1]).toContain('Bench Press');
  });

  it('encrypts and decrypts with a passphrase', () => {
    const env = encryptText('{"secret":true}', 'correct horse', random);
    expect(isEncryptedEnvelope(env)).toBe(true);
    expect(JSON.stringify(env)).not.toContain('secret');
    expect(decryptEnvelope(env, 'correct horse')).toBe('{"secret":true}');
    expect(() => decryptEnvelope(env, 'wrong')).toThrow(/Wrong passphrase/);
  });
});

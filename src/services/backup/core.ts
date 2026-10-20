import { z } from 'zod';
import { createInsertSchema } from 'drizzle-zod';
import journal from '../../../drizzle/meta/_journal.json';
import {
  appMeta,
  exerciseSets,
  exercises,
  recommendationHistory,
  routineSchedule,
  routines,
  sessionExercises,
  templateExercises,
  userPreferences,
  workoutSessions,
  workoutTemplates,
} from '@/db/schema';
import type { Db } from '@/db/types';

export const BACKUP_FORMAT = 'gym-planner-backup';
/** Number of applied migrations = data schema version. Read from the generated journal so it cannot drift. */
export const CURRENT_SCHEMA_VERSION: number = journal.entries.length;

const tableSchemas = {
  exercises: createInsertSchema(exercises),
  routines: createInsertSchema(routines),
  workout_templates: createInsertSchema(workoutTemplates),
  template_exercises: createInsertSchema(templateExercises),
  routine_schedule: createInsertSchema(routineSchedule),
  workout_sessions: createInsertSchema(workoutSessions),
  session_exercises: createInsertSchema(sessionExercises),
  exercise_sets: createInsertSchema(exerciseSets),
  recommendation_history: createInsertSchema(recommendationHistory),
  user_preferences: createInsertSchema(userPreferences),
  app_meta: createInsertSchema(appMeta),
};

export const BackupEnvelopeSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  schemaVersion: z.number().int().positive(),
  appVersion: z.string(),
  exportedAt: z.string(),
  tables: z.object({
    exercises: z.array(tableSchemas.exercises),
    routines: z.array(tableSchemas.routines),
    workout_templates: z.array(tableSchemas.workout_templates),
    template_exercises: z.array(tableSchemas.template_exercises),
    routine_schedule: z.array(tableSchemas.routine_schedule),
    workout_sessions: z.array(tableSchemas.workout_sessions),
    session_exercises: z.array(tableSchemas.session_exercises),
    exercise_sets: z.array(tableSchemas.exercise_sets),
    recommendation_history: z.array(tableSchemas.recommendation_history),
    user_preferences: z.array(tableSchemas.user_preferences),
    app_meta: z.array(tableSchemas.app_meta).default([]),
  }),
});

export type BackupEnvelope = z.infer<typeof BackupEnvelopeSchema>;

export interface BackupPreview {
  exportedAt: string;
  appVersion: string;
  schemaVersion: number;
  counts: Record<keyof BackupEnvelope['tables'], number>;
  completedSessions: number;
  dateRange: { from: string; to: string } | null;
}

export async function buildBackup(db: Db, appVersion: string, now: string = new Date().toISOString()): Promise<BackupEnvelope> {
  const [ex, rt, wt, te, rs, ws, se, es, rh, up, am] = await Promise.all([
    db.select().from(exercises),
    db.select().from(routines),
    db.select().from(workoutTemplates),
    db.select().from(templateExercises),
    db.select().from(routineSchedule),
    db.select().from(workoutSessions),
    db.select().from(sessionExercises),
    db.select().from(exerciseSets),
    db.select().from(recommendationHistory),
    db.select().from(userPreferences),
    db.select().from(appMeta),
  ]);
  return {
    format: BACKUP_FORMAT,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    appVersion,
    exportedAt: now,
    tables: {
      exercises: ex,
      routines: rt,
      workout_templates: wt,
      template_exercises: te,
      routine_schedule: rs,
      workout_sessions: ws,
      session_exercises: se,
      exercise_sets: es,
      recommendation_history: rh,
      user_preferences: up,
      app_meta: am,
    },
  };
}

export function serializeBackup(b: BackupEnvelope): string {
  return JSON.stringify(b);
}

export type ParseResult = { ok: true; backup: BackupEnvelope; preview: BackupPreview } | { ok: false; error: string };

/** Upgraders transform an older backup's tables to the next schema version. Keyed by "from" version. */
export const upgraders: Record<number, (b: BackupEnvelope) => BackupEnvelope> = {};

export function parseBackup(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON. Choose a Gym Planner backup (.json) file.' };
  }
  if (typeof json !== 'object' || json === null || (json as { format?: unknown }).format !== BACKUP_FORMAT) {
    return { ok: false, error: 'This file is not a Gym Planner backup.' };
  }
  const version = Number((json as { schemaVersion?: unknown }).schemaVersion);
  if (!Number.isInteger(version) || version < 1) return { ok: false, error: 'The backup has an invalid data version.' };
  if (version > CURRENT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This backup was created by a newer version of Gym Planner (data version ${version}; this app supports ${CURRENT_SCHEMA_VERSION}). Update the app, then restore.`,
    };
  }
  const parsed = BackupEnvelopeSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `The backup contains invalid data${issue ? ` (${issue.path.join('.')}: ${issue.message})` : ''}.` };
  }
  let backup = parsed.data;
  for (let v = backup.schemaVersion; v < CURRENT_SCHEMA_VERSION; v += 1) {
    const up = upgraders[v];
    if (!up) return { ok: false, error: `Cannot upgrade a backup from data version ${v}.` };
    backup = { ...up(backup), schemaVersion: v + 1 };
  }
  return { ok: true, backup, preview: previewOf(backup) };
}

export function previewOf(b: BackupEnvelope): BackupPreview {
  const sessions = b.tables.workout_sessions;
  const completed = sessions.filter((s) => s.status === 'completed');
  const dates = sessions.map((s) => s.localDate).sort();
  const counts = Object.fromEntries(Object.entries(b.tables).map(([k, v]) => [k, v.length])) as BackupPreview['counts'];
  return {
    exportedAt: b.exportedAt,
    appVersion: b.appVersion,
    schemaVersion: b.schemaVersion,
    counts,
    completedSessions: completed.length,
    dateRange: dates.length ? { from: dates[0] ?? '', to: dates[dates.length - 1] ?? '' } : null,
  };
}

const CHUNK = 100;
async function insertChunked<T extends object>(insert: (rows: T[]) => Promise<unknown>, rows: T[]) {
  for (let i = 0; i < rows.length; i += CHUNK) await insert(rows.slice(i, i + CHUNK));
}

/** Replaces ALL data with the backup contents in one transaction (FK-safe order). */
export async function restoreBackup(db: Db, b: BackupEnvelope): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(recommendationHistory);
    await tx.delete(exerciseSets);
    await tx.delete(sessionExercises);
    await tx.delete(workoutSessions);
    await tx.delete(routineSchedule);
    await tx.delete(templateExercises);
    await tx.delete(workoutTemplates);
    await tx.delete(routines);
    await tx.delete(exercises);
    await tx.delete(userPreferences);
    await tx.delete(appMeta);

    await insertChunked((r) => tx.insert(exercises).values(r), b.tables.exercises);
    await insertChunked((r) => tx.insert(routines).values(r), b.tables.routines);
    await insertChunked((r) => tx.insert(workoutTemplates).values(r), b.tables.workout_templates);
    await insertChunked((r) => tx.insert(templateExercises).values(r), b.tables.template_exercises);
    await insertChunked((r) => tx.insert(routineSchedule).values(r), b.tables.routine_schedule);
    await insertChunked((r) => tx.insert(workoutSessions).values(r), b.tables.workout_sessions);
    await insertChunked((r) => tx.insert(sessionExercises).values(r), b.tables.session_exercises);
    await insertChunked((r) => tx.insert(exerciseSets).values(r), b.tables.exercise_sets);
    await insertChunked((r) => tx.insert(recommendationHistory).values(r), b.tables.recommendation_history);
    await insertChunked((r) => tx.insert(userPreferences).values(r), b.tables.user_preferences);
    await insertChunked((r) => tx.insert(appMeta).values(r), b.tables.app_meta);
  });
}

// ---------- CSV ----------

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const CSV_COLUMNS = [
  'session_id',
  'session_date',
  'session_started_at',
  'session_completed_at',
  'session_status',
  'routine_name',
  'template_name',
  'readiness',
  'exercise_order',
  'exercise_name',
  'exercise_status',
  'set_number',
  'set_type',
  'target_reps',
  'actual_reps',
  'weight',
  'weight_unit',
  'duration_seconds',
  'distance',
  'distance_unit',
  'rpe',
  'rir',
  'completed',
  'completed_at',
  'exercise_notes',
  'session_notes',
] as const;

export function backupToCsv(b: BackupEnvelope): string {
  const sessions = new Map(b.tables.workout_sessions.map((s) => [s.id, s]));
  const sessionExs = new Map(b.tables.session_exercises.map((e) => [e.id, e]));
  const rows = [...b.tables.exercise_sets]
    .map((set) => {
      const se = sessionExs.get(set.sessionExerciseId);
      const s = se ? sessions.get(se.sessionId) : undefined;
      return { set, se, s };
    })
    .filter((r) => r.se && r.s)
    .sort((a, b2) => {
      const d = (a.s?.startedAt ?? '').localeCompare(b2.s?.startedAt ?? '');
      if (d !== 0) return d;
      const p = (a.se?.position ?? 0) - (b2.se?.position ?? 0);
      return p !== 0 ? p : a.set.setNumber - b2.set.setNumber;
    });
  const lines = [CSV_COLUMNS.join(',')];
  for (const { set, se, s } of rows) {
    if (!se || !s) continue;
    lines.push(
      [
        s.id,
        s.localDate,
        s.startedAt,
        s.completedAt,
        s.status,
        s.routineNameSnapshot,
        s.templateNameSnapshot,
        s.readiness,
        se.position,
        se.exerciseNameSnapshot,
        se.status,
        set.setNumber,
        set.setType,
        set.targetReps,
        set.actualReps,
        set.weight,
        set.weightUnit,
        set.durationSeconds,
        set.distance,
        set.distanceUnit,
        set.rpe,
        set.rir,
        set.completed ? 1 : 0,
        set.completedAt,
        se.notes,
        s.notes,
      ]
        .map(csvCell)
        .join(','),
    );
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

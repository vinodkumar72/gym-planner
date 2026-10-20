import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * Drizzle schema for the on-device SQLite database.
 * Column naming is snake_case in SQL, camelCase in TypeScript.
 * Booleans are stored as integers (0/1); timestamps are ISO 8601 strings.
 */

const timestamps = {
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
};

export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    primaryMuscleGroup: text('primary_muscle_group').notNull(),
    /** JSON array of muscle group names */
    secondaryMuscleGroups: text('secondary_muscle_groups').notNull().default('[]'),
    equipment: text('equipment').notNull(),
    /** 'strength' | 'cardio' | 'duration' */
    exerciseType: text('exercise_type').notNull(),
    isBodyweight: integer('is_bodyweight').notNull().default(0),
    instructions: text('instructions'),
    /** smallest sensible load (e.g. empty barbell) */
    minLoad: real('min_load'),
    minLoadUnit: text('min_load_unit'),
    defaultIncrementLb: real('default_increment_lb').notNull().default(5),
    defaultIncrementKg: real('default_increment_kg').notNull().default(2.5),
    isCustom: integer('is_custom').notNull().default(0),
    isArchived: integer('is_archived').notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index('idx_exercises_muscle').on(t.primaryMuscleGroup),
    index('idx_exercises_name').on(t.name),
  ],
);

export const routines = sqliteTable(
  'routines',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    description: text('description'),
    /** 'rotation' | 'calendar' */
    rotationType: text('rotation_type').notNull().default('rotation'),
    isActive: integer('is_active').notNull().default(0),
    isBuiltin: integer('is_builtin').notNull().default(0),
    isArchived: integer('is_archived').notNull().default(0),
    sourceRoutineId: text('source_routine_id'),
    activatedAt: text('activated_at'),
    ...timestamps,
  },
  (t) => [index('idx_routines_active').on(t.isActive)],
);

export const workoutTemplates = sqliteTable(
  'workout_templates',
  {
    id: text('id').primaryKey(),
    routineId: text('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    position: integer('position').notNull(),
    ...timestamps,
  },
  (t) => [index('idx_templates_routine').on(t.routineId)],
);

export const templateExercises = sqliteTable(
  'template_exercises',
  {
    id: text('id').primaryKey(),
    templateId: text('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    targetSets: integer('target_sets').notNull().default(3),
    minReps: integer('min_reps').notNull().default(8),
    maxReps: integer('max_reps').notNull().default(12),
    restSeconds: integer('rest_seconds').notNull().default(90),
    progressionIncrement: real('progression_increment').notNull().default(5),
    /** 'lb' | 'kg' (weighted) — for bodyweight it is reps, for timed it is seconds */
    incrementUnit: text('increment_unit').notNull().default('lb'),
    targetDurationSeconds: integer('target_duration_seconds'),
    targetDistance: real('target_distance'),
    ...timestamps,
  },
  (t) => [index('idx_template_exercises_template').on(t.templateId)],
);

export const routineSchedule = sqliteTable(
  'routine_schedule',
  {
    id: text('id').primaryKey(),
    routineId: text('routine_id')
      .notNull()
      .references(() => routines.id, { onDelete: 'cascade' }),
    /** 0 = Sunday ... 6 = Saturday (JS Date#getDay) */
    dayOfWeek: integer('day_of_week').notNull(),
    templateId: text('template_id')
      .notNull()
      .references(() => workoutTemplates.id, { onDelete: 'cascade' }),
  },
  (t) => [uniqueIndex('uq_schedule_routine_day').on(t.routineId, t.dayOfWeek)],
);

export const workoutSessions = sqliteTable(
  'workout_sessions',
  {
    id: text('id').primaryKey(),
    routineId: text('routine_id').references(() => routines.id, { onDelete: 'set null' }),
    templateId: text('template_id').references(() => workoutTemplates.id, { onDelete: 'set null' }),
    routineNameSnapshot: text('routine_name_snapshot').notNull().default(''),
    templateNameSnapshot: text('template_name_snapshot').notNull().default(''),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    /** local calendar date YYYY-MM-DD of startedAt */
    localDate: text('local_date').notNull(),
    /** 'in_progress' | 'completed' | 'abandoned' */
    status: text('status').notNull().default('in_progress'),
    /** 'ready' | 'tired' | 'sore' | 'rest' */
    readiness: text('readiness'),
    notes: text('notes'),
    durationSeconds: integer('duration_seconds'),
    restEndsAt: integer('rest_ends_at'),
    restDurationSeconds: integer('rest_duration_seconds'),
    restSessionExerciseId: text('rest_session_exercise_id'),
    ...timestamps,
  },
  (t) => [
    index('idx_sessions_local_date').on(t.localDate),
    index('idx_sessions_status').on(t.status),
    index('idx_sessions_started').on(t.startedAt),
  ],
);

export const sessionExercises = sqliteTable(
  'session_exercises',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    exerciseNameSnapshot: text('exercise_name_snapshot').notNull().default(''),
    position: integer('position').notNull(),
    /** 'pending' | 'completed' | 'skipped' | 'substituted' */
    status: text('status').notNull().default('pending'),
    substitutedFromExerciseId: text('substituted_from_exercise_id').references(() => exercises.id, {
      onDelete: 'set null',
    }),
    restSeconds: integer('rest_seconds').notNull().default(90),
    targetSets: integer('target_sets').notNull().default(3),
    minReps: integer('min_reps').notNull().default(8),
    maxReps: integer('max_reps').notNull().default(12),
    progressionIncrement: real('progression_increment').notNull().default(5),
    incrementUnit: text('increment_unit').notNull().default('lb'),
    targetDurationSeconds: integer('target_duration_seconds'),
    targetDistance: real('target_distance'),
    notes: text('notes'),
  },
  (t) => [
    index('idx_session_exercises_session').on(t.sessionId),
    index('idx_session_exercises_exercise').on(t.exerciseId),
  ],
);

export const exerciseSets = sqliteTable(
  'exercise_sets',
  {
    id: text('id').primaryKey(),
    sessionExerciseId: text('session_exercise_id')
      .notNull()
      .references(() => sessionExercises.id, { onDelete: 'cascade' }),
    setNumber: integer('set_number').notNull(),
    /** 'warmup' | 'working' */
    setType: text('set_type').notNull().default('working'),
    targetReps: integer('target_reps'),
    actualReps: integer('actual_reps'),
    weight: real('weight'),
    /** 'lb' | 'kg' */
    weightUnit: text('weight_unit'),
    durationSeconds: integer('duration_seconds'),
    distance: real('distance'),
    /** 'km' | 'mi' */
    distanceUnit: text('distance_unit'),
    rpe: real('rpe'),
    rir: integer('rir'),
    completed: integer('completed').notNull().default(0),
    completedAt: text('completed_at'),
  },
  (t) => [index('idx_sets_session_exercise').on(t.sessionExerciseId)],
);

export const userPreferences = sqliteTable('user_preferences', {
  id: text('id').primaryKey(),
  weightUnit: text('weight_unit').notNull().default('lb'),
  distanceUnit: text('distance_unit').notNull().default('mi'),
  trainingDaysPerWeek: integer('training_days_per_week').notNull().default(3),
  /** JSON array of day numbers 0-6 */
  preferredTrainingDays: text('preferred_training_days').notNull().default('[1,3,5]'),
  defaultRestSeconds: integer('default_rest_seconds').notNull().default(90),
  notificationsEnabled: integer('notifications_enabled').notNull().default(0),
  /** HH:MM local */
  reminderTime: text('reminder_time').notNull().default('17:00'),
  restDayReminder: integer('rest_day_reminder').notNull().default(0),
  goal: text('goal'),
  experienceLevel: text('experience_level'),
  /** JSON array of equipment keys */
  equipment: text('equipment').notNull().default('[]'),
  /** 'system' | 'light' | 'dark' */
  theme: text('theme').notNull().default('system'),
  onboardingCompleted: integer('onboarding_completed').notNull().default(0),
  ...timestamps,
});

export const recommendationHistory = sqliteTable(
  'recommendation_history',
  {
    id: text('id').primaryKey(),
    sessionId: text('session_id')
      .notNull()
      .references(() => workoutSessions.id, { onDelete: 'cascade' }),
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    /** 'weighted' | 'bodyweight' | 'timed' | 'cardio' */
    recommendationType: text('recommendation_type').notNull(),
    /** 'increase' | 'maintain' | 'decrease' | 'review' */
    action: text('action').notNull(),
    reasonCode: text('reason_code').notNull(),
    suggestedWeight: real('suggested_weight'),
    suggestedWeightUnit: text('suggested_weight_unit'),
    suggestedReps: integer('suggested_reps'),
    suggestedDurationSeconds: integer('suggested_duration_seconds'),
    explanation: text('explanation').notNull(),
    prescriptionJson: text('prescription_json').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (t) => [
    index('idx_reco_session').on(t.sessionId),
    index('idx_reco_exercise').on(t.exerciseId),
  ],
);

export const appMeta = sqliteTable('app_meta', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export const schema = {
  exercises,
  routines,
  workoutTemplates,
  templateExercises,
  routineSchedule,
  workoutSessions,
  sessionExercises,
  exerciseSets,
  userPreferences,
  recommendationHistory,
  appMeta,
};

export type ExerciseRow = typeof exercises.$inferSelect;
export type NewExerciseRow = typeof exercises.$inferInsert;
export type RoutineRow = typeof routines.$inferSelect;
export type NewRoutineRow = typeof routines.$inferInsert;
export type WorkoutTemplateRow = typeof workoutTemplates.$inferSelect;
export type NewWorkoutTemplateRow = typeof workoutTemplates.$inferInsert;
export type TemplateExerciseRow = typeof templateExercises.$inferSelect;
export type NewTemplateExerciseRow = typeof templateExercises.$inferInsert;
export type RoutineScheduleRow = typeof routineSchedule.$inferSelect;
export type WorkoutSessionRow = typeof workoutSessions.$inferSelect;
export type NewWorkoutSessionRow = typeof workoutSessions.$inferInsert;
export type SessionExerciseRow = typeof sessionExercises.$inferSelect;
export type NewSessionExerciseRow = typeof sessionExercises.$inferInsert;
export type ExerciseSetRow = typeof exerciseSets.$inferSelect;
export type NewExerciseSetRow = typeof exerciseSets.$inferInsert;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;
export type RecommendationHistoryRow = typeof recommendationHistory.$inferSelect;
export type NewRecommendationHistoryRow = typeof recommendationHistory.$inferInsert;

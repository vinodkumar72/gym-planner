CREATE TABLE `app_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `exercise_sets` (
	`id` text PRIMARY KEY NOT NULL,
	`session_exercise_id` text NOT NULL,
	`set_number` integer NOT NULL,
	`set_type` text DEFAULT 'working' NOT NULL,
	`target_reps` integer,
	`actual_reps` integer,
	`weight` real,
	`weight_unit` text,
	`duration_seconds` integer,
	`distance` real,
	`distance_unit` text,
	`rpe` real,
	`rir` integer,
	`completed` integer DEFAULT 0 NOT NULL,
	`completed_at` text,
	FOREIGN KEY (`session_exercise_id`) REFERENCES `session_exercises`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_sets_session_exercise` ON `exercise_sets` (`session_exercise_id`);--> statement-breakpoint
CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`primary_muscle_group` text NOT NULL,
	`secondary_muscle_groups` text DEFAULT '[]' NOT NULL,
	`equipment` text NOT NULL,
	`exercise_type` text NOT NULL,
	`is_bodyweight` integer DEFAULT 0 NOT NULL,
	`instructions` text,
	`min_load` real,
	`min_load_unit` text,
	`default_increment_lb` real DEFAULT 5 NOT NULL,
	`default_increment_kg` real DEFAULT 2.5 NOT NULL,
	`is_custom` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_exercises_muscle` ON `exercises` (`primary_muscle_group`);--> statement-breakpoint
CREATE INDEX `idx_exercises_name` ON `exercises` (`name`);--> statement-breakpoint
CREATE TABLE `recommendation_history` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`recommendation_type` text NOT NULL,
	`action` text NOT NULL,
	`reason_code` text NOT NULL,
	`suggested_weight` real,
	`suggested_weight_unit` text,
	`suggested_reps` integer,
	`suggested_duration_seconds` integer,
	`explanation` text NOT NULL,
	`prescription_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_reco_session` ON `recommendation_history` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_reco_exercise` ON `recommendation_history` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `routine_schedule` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`day_of_week` integer NOT NULL,
	`template_id` text NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `uq_schedule_routine_day` ON `routine_schedule` (`routine_id`,`day_of_week`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rotation_type` text DEFAULT 'rotation' NOT NULL,
	`is_active` integer DEFAULT 0 NOT NULL,
	`is_builtin` integer DEFAULT 0 NOT NULL,
	`is_archived` integer DEFAULT 0 NOT NULL,
	`source_routine_id` text,
	`activated_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_routines_active` ON `routines` (`is_active`);--> statement-breakpoint
CREATE TABLE `session_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`exercise_name_snapshot` text DEFAULT '' NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`substituted_from_exercise_id` text,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`min_reps` integer DEFAULT 8 NOT NULL,
	`max_reps` integer DEFAULT 12 NOT NULL,
	`progression_increment` real DEFAULT 5 NOT NULL,
	`increment_unit` text DEFAULT 'lb' NOT NULL,
	`target_duration_seconds` integer,
	`target_distance` real,
	`notes` text,
	FOREIGN KEY (`session_id`) REFERENCES `workout_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`substituted_from_exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_session_exercises_session` ON `session_exercises` (`session_id`);--> statement-breakpoint
CREATE INDEX `idx_session_exercises_exercise` ON `session_exercises` (`exercise_id`);--> statement-breakpoint
CREATE TABLE `template_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`template_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`position` integer NOT NULL,
	`target_sets` integer DEFAULT 3 NOT NULL,
	`min_reps` integer DEFAULT 8 NOT NULL,
	`max_reps` integer DEFAULT 12 NOT NULL,
	`rest_seconds` integer DEFAULT 90 NOT NULL,
	`progression_increment` real DEFAULT 5 NOT NULL,
	`increment_unit` text DEFAULT 'lb' NOT NULL,
	`target_duration_seconds` integer,
	`target_distance` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `idx_template_exercises_template` ON `template_exercises` (`template_id`);--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`weight_unit` text DEFAULT 'lb' NOT NULL,
	`distance_unit` text DEFAULT 'mi' NOT NULL,
	`training_days_per_week` integer DEFAULT 3 NOT NULL,
	`preferred_training_days` text DEFAULT '[1,3,5]' NOT NULL,
	`default_rest_seconds` integer DEFAULT 90 NOT NULL,
	`notifications_enabled` integer DEFAULT 0 NOT NULL,
	`reminder_time` text DEFAULT '17:00' NOT NULL,
	`rest_day_reminder` integer DEFAULT 0 NOT NULL,
	`goal` text,
	`experience_level` text,
	`equipment` text DEFAULT '[]' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`onboarding_completed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workout_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text,
	`template_id` text,
	`routine_name_snapshot` text DEFAULT '' NOT NULL,
	`template_name_snapshot` text DEFAULT '' NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`local_date` text NOT NULL,
	`status` text DEFAULT 'in_progress' NOT NULL,
	`readiness` text,
	`notes` text,
	`duration_seconds` integer,
	`rest_ends_at` integer,
	`rest_duration_seconds` integer,
	`rest_session_exercise_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_local_date` ON `workout_sessions` (`local_date`);--> statement-breakpoint
CREATE INDEX `idx_sessions_status` ON `workout_sessions` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sessions_started` ON `workout_sessions` (`started_at`);--> statement-breakpoint
CREATE TABLE `workout_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`name` text NOT NULL,
	`position` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_templates_routine` ON `workout_templates` (`routine_id`);
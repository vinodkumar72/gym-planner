import type { Readiness, RotationType, SessionStatus } from '../models/types';

export type Intensity = 'normal' | 'reduced';

export interface TemplateRef {
  id: string;
  name: string;
  position: number;
}

export interface ScheduleEntry {
  /** 0 = Sunday ... 6 = Saturday */
  dayOfWeek: number;
  templateId: string;
}

export interface ActiveRoutine {
  id: string;
  name: string;
  rotationType: RotationType;
  /** ISO; scheduled days before this are not considered missed */
  activatedAt: string | null;
  templates: TemplateRef[];
  schedule: ScheduleEntry[];
}

export interface SessionSummary {
  id: string;
  routineId: string | null;
  templateId: string | null;
  templateName: string;
  status: SessionStatus;
  startedAt: string;
  completedAt: string | null;
}

export interface NextWorkoutInput {
  routine: ActiveRoutine | null;
  inProgressSession: SessionSummary | null;
  /** most recent completed session across all routines */
  lastCompletedSession: SessionSummary | null;
  /** completed sessions within the lookback window (any order) */
  recentCompletedSessions: SessionSummary[];
  readiness: Readiness | null;
  /** local "now" */
  now: Date;
  missedLookbackDays?: number;
}

export interface WorkoutOption {
  templateId: string;
  templateName: string;
  routineId: string;
  position: number;
  source: 'rotation' | 'calendar';
  role: 'next' | 'scheduled' | 'missed';
  /** YYYY-MM-DD local for calendar options */
  scheduledFor: string | null;
  intensity: Intensity;
}

export type Recommendation =
  | {
      kind: 'resume';
      sessionId: string;
      templateId: string | null;
      templateName: string;
      startedAt: string;
      reason: string;
    }
  | { kind: 'workout'; option: WorkoutOption; reason: string }
  | {
      kind: 'choice';
      missed: WorkoutOption;
      /** null means today is a rest day: do the missed one or rest */
      scheduled: WorkoutOption | null;
      reason: string;
    }
  | {
      kind: 'rest_day';
      source: 'calendar' | 'readiness' | 'completed_today';
      override: TrainableRecommendation | null;
      reason: string;
    }
  | { kind: 'no_routine'; reason: string };

export type TrainableRecommendation = Extract<Recommendation, { kind: 'workout' | 'choice' }>;

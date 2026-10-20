import type { ExerciseKind, Readiness, SetType, WeightUnit } from '../models/types';

export type ProgressionAction = 'increase' | 'maintain' | 'decrease' | 'review';

export interface PerformedSet {
  setType: SetType;
  completed: boolean;
  targetReps: number | null;
  actualReps: number | null;
  weight: number | null;
  weightUnit: WeightUnit | null;
  durationSeconds: number | null;
  distance: number | null;
  rpe?: number | null;
  rir?: number | null;
}

/** One session's work for an exercise. */
export interface PerformedExercise {
  sessionId: string;
  performedAt: string;
  sets: PerformedSet[];
}

export interface ProgressionTarget {
  targetSets: number;
  minReps: number;
  maxReps: number;
  /** weighted: load in incrementUnit; bodyweight: reps; timed: seconds */
  progressionIncrement: number;
  incrementUnit: WeightUnit;
  targetDurationSeconds: number | null;
  targetDistance: number | null;
}

export interface ProgressionInput {
  exercise: {
    id: string;
    kind: ExerciseKind;
    minLoad: number | null;
    minLoadUnit: WeightUnit | null;
  };
  target: ProgressionTarget;
  /** prescription is expressed in this unit */
  displayUnit: WeightUnit;
  /** equipment step in displayUnit; default 2.5 lb / 1.25 kg */
  roundTo?: number;
  readiness: Readiness | null;
  /** newest first */
  history: PerformedExercise[];
}

export type Prescription =
  | {
      kind: 'weighted';
      weight: number | null;
      unit: WeightUnit;
      targetSets: number;
      minReps: number;
      maxReps: number;
    }
  | { kind: 'bodyweight'; targetReps: number | null; targetSets: number }
  | { kind: 'timed'; durationSeconds: number | null; targetSets: number }
  | {
      kind: 'cardio';
      durationSeconds: number | null;
      distance: number | null;
      suggestion: { durationSeconds: [number, number] | null; distance: [number, number] | null } | null;
    };

export type ReasonCode =
  | 'NO_HISTORY'
  | 'NO_WORKING_SETS'
  | 'NO_TARGET_DURATION'
  | 'ALL_SETS_AT_MAX'
  | 'NOT_ALL_SETS_AT_MAX'
  | 'READINESS_BLOCKS_INCREASE'
  | 'FAILED_TWO_SESSIONS'
  | 'FAILED_ONCE_NO_HISTORY'
  | 'FAILED_ONCE_PRIOR_OK'
  | 'AT_MIN_LOAD'
  | 'CARDIO_SUGGEST'
  | 'CARDIO_HOLD';

export interface ProgressionResult {
  action: ProgressionAction;
  reasonCode: ReasonCode;
  reason: string;
  prescription: Prescription;
  basedOn: {
    sessionId: string;
    topLoad: number | null;
    unit: WeightUnit;
    setsAtMax: number;
    setsCompleted: number;
  } | null;
}

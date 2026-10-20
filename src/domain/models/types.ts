/** Shared domain vocabulary. Pure types and constants; no runtime dependencies. */

export type WeightUnit = 'lb' | 'kg';
export type DistanceUnit = 'km' | 'mi';
export type Readiness = 'ready' | 'tired' | 'sore' | 'rest';
export type RotationType = 'rotation' | 'calendar';
export type SessionStatus = 'in_progress' | 'completed' | 'abandoned';
export type SessionExerciseStatus = 'pending' | 'completed' | 'skipped' | 'substituted';
export type SetType = 'warmup' | 'working';
export type ExerciseType = 'strength' | 'cardio' | 'duration';
/** Engine-level classification derived from exerciseType + isBodyweight */
export type ExerciseKind = 'weighted' | 'bodyweight' | 'timed' | 'cardio';
export type ThemePreference = 'system' | 'light' | 'dark';
export type Goal = 'strength' | 'muscle' | 'general' | 'consistency';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export const MUSCLE_GROUPS = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'quadriceps',
  'hamstrings',
  'glutes',
  'calves',
  'core',
  'cardio',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'cable',
  'kettlebell',
  'bodyweight',
  'band',
  'cardio_machine',
  'other',
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const READINESS_OPTIONS: { value: Readiness; label: string; hint: string }[] = [
  { value: 'ready', label: 'Ready', hint: 'Feeling good, train as planned' },
  { value: 'tired', label: 'Tired', hint: 'Low energy, keep loads steady' },
  { value: 'sore', label: 'Sore', hint: 'Still recovering, go lighter' },
  { value: 'rest', label: 'Need rest', hint: 'Take the day off' },
];

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function exerciseKind(exerciseType: string, isBodyweight: boolean | number): ExerciseKind {
  if (exerciseType === 'cardio') return 'cardio';
  if (exerciseType === 'duration') return 'timed';
  return isBodyweight ? 'bodyweight' : 'weighted';
}

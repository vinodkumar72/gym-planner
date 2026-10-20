import type { Db } from '@/db/types';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { getPreferences } from '@/db/repositories/preferencesRepo';
import { getExercise } from '@/db/repositories/exerciseRepo';
import type { ExerciseRow, WorkoutSessionRow } from '@/db/schema';
import type { WeightUnit } from '@/domain/models/types';
import { addDays, localDate, parseLocalDate } from '@/domain/workout-engine';
import {
  consistency,
  exerciseTrend,
  personalRecords,
  weeklyFrequency,
  type ExerciseTrendPoint,
  type PersonalRecords,
  type Streaks,
  type WeekBucket,
} from '@/domain/analytics/stats';
import { convertWeight } from '@/utils/units';

export async function sessionsForMonth(db: Db, year: number, month0: number): Promise<WorkoutSessionRow[]> {
  const from = localDate(new Date(year, month0, 1));
  const to = localDate(new Date(year, month0 + 1, 0));
  return sessionRepo.listSessions(db, { fromLocalDate: from, toLocalDate: to, limit: 500 });
}

export async function recentSessions(db: Db, limit = 30, offset = 0): Promise<WorkoutSessionRow[]> {
  return sessionRepo.listSessions(db, { limit, offset });
}

export interface ProgressOverview {
  totalSessions: number;
  weekly: WeekBucket[];
  streaks: Streaks;
  volumeUnit: WeightUnit;
  trainedExercises: { exercise: ExerciseRow; sessions: number; lastDate: string }[];
  muscleGroupSets: { group: string; sets: number }[];
}

export async function progressOverview(db: Db, now: Date = new Date(), weeks = 8): Promise<ProgressOverview> {
  const prefs = await getPreferences(db);
  const unit: WeightUnit = prefs.weightUnit === 'kg' ? 'kg' : 'lb';
  const today = localDate(now);
  const from = localDate(addDays(parseLocalDate(today), -7 * weeks));
  const [total, sets, trained, sessions] = await Promise.all([
    sessionRepo.countCompletedSessions(db),
    sessionRepo.getCompletedSetsBetween(db, from, today),
    sessionRepo.listTrainedExercises(db),
    sessionRepo.listSessions(db, { status: 'completed', fromLocalDate: from, toLocalDate: today, limit: 10_000 }),
  ]);
  const volumeByDate = new Map<string, number>();
  const groupSets = new Map<string, number>();
  for (const s of sets) {
    if (s.weight !== null && s.actualReps !== null) {
      const v = convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? unit, unit) * s.actualReps;
      volumeByDate.set(s.localDate, (volumeByDate.get(s.localDate) ?? 0) + v);
    }
    groupSets.set(s.muscleGroup, (groupSets.get(s.muscleGroup) ?? 0) + 1);
  }
  const dates = sessions.map((s) => s.localDate);
  const allDates = (await sessionRepo.listSessions(db, { status: 'completed', limit: 10_000 })).map((s) => s.localDate);
  return {
    totalSessions: total,
    weekly: weeklyFrequency(dates, today, weeks, volumeByDate),
    streaks: consistency(allDates, today, prefs.trainingDaysPerWeek),
    volumeUnit: unit,
    trainedExercises: trained,
    muscleGroupSets: [...groupSets.entries()].map(([group, n]) => ({ group, sets: n })).sort((a, b) => b.sets - a.sets),
  };
}

export interface ExerciseProgress {
  exercise: ExerciseRow;
  unit: WeightUnit;
  trend: ExerciseTrendPoint[];
  records: PersonalRecords;
}

export async function exerciseProgress(db: Db, exerciseId: string): Promise<ExerciseProgress | null> {
  const exercise = await getExercise(db, exerciseId);
  if (!exercise) return null;
  const prefs = await getPreferences(db);
  const unit: WeightUnit = prefs.weightUnit === 'kg' ? 'kg' : 'lb';
  const sets = await sessionRepo.getAllCompletedSetsForExercise(db, exerciseId);
  return {
    exercise,
    unit,
    trend: exerciseTrend(sets, unit),
    records: personalRecords(sets, unit),
  };
}

export async function deleteSessionPermanently(db: Db, sessionId: string): Promise<void> {
  await sessionRepo.deleteSession(db, sessionId);
}

import type { WeightUnit } from '../models/types';
import { addDays, localDate, parseLocalDate } from '../workout-engine/dates';
import { convertWeight, roundTo } from '@/utils/units';

export interface SetSample {
  localDate: string;
  sessionId: string;
  weight: number | null;
  weightUnit: string | null;
  actualReps: number | null;
  durationSeconds: number | null;
}

/** Epley estimate; clearly labelled as an estimate in the UI. */
export function estimateOneRepMax(weight: number, reps: number): number {
  if (reps <= 0) return 0;
  if (reps === 1) return weight;
  return roundTo(weight * (1 + reps / 30), 1);
}

export interface ExerciseTrendPoint {
  localDate: string;
  topWeight: number;
  topReps: number;
  est1rm: number;
  volume: number;
}

/** One point per session: heaviest completed working set, est 1RM and volume in displayUnit. */
export function exerciseTrend(sets: SetSample[], displayUnit: WeightUnit): ExerciseTrendPoint[] {
  const bySession = new Map<string, SetSample[]>();
  for (const s of sets) {
    const list = bySession.get(s.sessionId) ?? [];
    list.push(s);
    bySession.set(s.sessionId, list);
  }
  const points: ExerciseTrendPoint[] = [];
  for (const list of bySession.values()) {
    let topWeight = 0;
    let topReps = 0;
    let est = 0;
    let volume = 0;
    for (const s of list) {
      if (s.weight === null || s.actualReps === null) continue;
      const w = convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? displayUnit, displayUnit);
      volume += w * s.actualReps;
      const e = estimateOneRepMax(w, s.actualReps);
      if (w > topWeight || (w === topWeight && s.actualReps > topReps)) {
        topWeight = w;
        topReps = s.actualReps;
      }
      if (e > est) est = e;
    }
    const first = list[0];
    if (!first) continue;
    points.push({
      localDate: first.localDate,
      topWeight: roundTo(topWeight, 2),
      topReps,
      est1rm: roundTo(est, 1),
      volume: roundTo(volume, 0),
    });
  }
  return points.sort((a, b) => a.localDate.localeCompare(b.localDate));
}

export interface PersonalRecords {
  bestWeight: { weight: number; reps: number; localDate: string } | null;
  bestEst1rm: { value: number; weight: number; reps: number; localDate: string } | null;
  bestReps: { reps: number; weight: number; localDate: string } | null;
  bestDuration: { seconds: number; localDate: string } | null;
}

export function personalRecords(sets: SetSample[], displayUnit: WeightUnit): PersonalRecords {
  const pr: PersonalRecords = { bestWeight: null, bestEst1rm: null, bestReps: null, bestDuration: null };
  for (const s of sets) {
    if (s.durationSeconds !== null && s.durationSeconds > 0) {
      if (!pr.bestDuration || s.durationSeconds > pr.bestDuration.seconds) {
        pr.bestDuration = { seconds: s.durationSeconds, localDate: s.localDate };
      }
    }
    if (s.weight === null || s.actualReps === null || s.actualReps <= 0) {
      if (s.actualReps !== null && s.actualReps > 0 && (!pr.bestReps || s.actualReps > pr.bestReps.reps)) {
        pr.bestReps = { reps: s.actualReps, weight: 0, localDate: s.localDate };
      }
      continue;
    }
    const w = roundTo(convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? displayUnit, displayUnit), 2);
    if (!pr.bestWeight || w > pr.bestWeight.weight || (w === pr.bestWeight.weight && s.actualReps > pr.bestWeight.reps)) {
      pr.bestWeight = { weight: w, reps: s.actualReps, localDate: s.localDate };
    }
    const e = estimateOneRepMax(w, s.actualReps);
    if (!pr.bestEst1rm || e > pr.bestEst1rm.value) {
      pr.bestEst1rm = { value: e, weight: w, reps: s.actualReps, localDate: s.localDate };
    }
    if (!pr.bestReps || s.actualReps > pr.bestReps.reps) {
      pr.bestReps = { reps: s.actualReps, weight: w, localDate: s.localDate };
    }
  }
  return pr;
}

export interface WeekBucket {
  /** Monday of the week, YYYY-MM-DD */
  weekStart: string;
  sessions: number;
  volume: number;
}

export function mondayOf(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  return localDate(addDays(d, diff));
}

/** Sessions per week for the last `weeks` weeks ending at `today`, oldest first; empty weeks included. */
export function weeklyFrequency(
  sessionDates: string[],
  today: string,
  weeks: number,
  volumeByDate: Map<string, number> = new Map(),
): WeekBucket[] {
  const buckets = new Map<string, WeekBucket>();
  const lastMonday = mondayOf(today);
  for (let i = weeks - 1; i >= 0; i -= 1) {
    const ws = localDate(addDays(parseLocalDate(lastMonday), -7 * i));
    buckets.set(ws, { weekStart: ws, sessions: 0, volume: 0 });
  }
  for (const d of sessionDates) {
    const b = buckets.get(mondayOf(d));
    if (b) {
      b.sessions += 1;
      b.volume += volumeByDate.get(d) ?? 0;
    }
  }
  return [...buckets.values()];
}

export interface Streaks {
  /** consecutive weeks (ending this week or last) with >= target sessions */
  currentWeekStreak: number;
  longestWeekStreak: number;
  /** calendar days since last completed workout, null if none */
  daysSinceLast: number | null;
  thisWeekSessions: number;
}

export function consistency(sessionDates: string[], today: string, weeklyTarget: number): Streaks {
  const sorted = [...new Set(sessionDates)].sort();
  const weeks = weeklyFrequency(sorted, today, 52);
  const target = Math.max(1, weeklyTarget);
  let longest = 0;
  let run = 0;
  for (const w of weeks) {
    if (w.sessions >= target) {
      run += 1;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  // current streak: count back from this week; this week may still be in progress so allow it to be incomplete
  let current = 0;
  const idx = weeks.length - 1;
  const thisWeek = weeks[idx];
  let start = idx;
  if (thisWeek && thisWeek.sessions < target) start = idx - 1;
  for (let i = start; i >= 0; i -= 1) {
    const w = weeks[i];
    if (w && w.sessions >= target) current += 1;
    else break;
  }
  const last = sorted[sorted.length - 1];
  const daysSinceLast = last
    ? Math.round((parseLocalDate(today).getTime() - parseLocalDate(last).getTime()) / 86_400_000)
    : null;
  return { currentWeekStreak: current, longestWeekStreak: longest, daysSinceLast, thisWeekSessions: thisWeek?.sessions ?? 0 };
}

/** Estimated session length in minutes from the template's sets and rest times. */
export function estimateDurationMinutes(
  exercises: { targetSets: number; restSeconds: number; targetDurationSeconds: number | null; exerciseType: string }[],
): number {
  let seconds = 0;
  for (const e of exercises) {
    if (e.exerciseType === 'cardio') {
      seconds += (e.targetDurationSeconds ?? 1200) + 120;
      continue;
    }
    const work = e.exerciseType === 'duration' ? (e.targetDurationSeconds ?? 30) : 40;
    seconds += e.targetSets * (work + e.restSeconds) + 60;
  }
  return Math.max(5, Math.round(seconds / 60));
}

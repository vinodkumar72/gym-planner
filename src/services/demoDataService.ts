import type { Db } from '@/db/types';
import * as routineRepo from '@/db/repositories/routineRepo';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import { getPreferences } from '@/db/repositories/preferencesRepo';
import type { WeightUnit } from '@/domain/models/types';
import { localDate } from '@/domain/workout-engine';
import { convertWeight, roundToStep } from '@/utils/units';
import { finishWorkout, startWorkout } from './workoutService';

export interface DemoDataOptions {
  weeks?: number;
  sessionsPerWeek?: number;
  now?: Date;
  idFactory: () => string;
}

/** Plausible starting loads (lb) for the built-in exercises; others fall back to a type-based default. */
const START_LB: Record<string, number> = {
  ex_bench_press: 95,
  ex_incline_db_press: 35,
  ex_shoulder_press: 30,
  ex_tricep_pushdown: 40,
  ex_lat_pulldown: 90,
  ex_seated_row: 80,
  ex_db_row: 40,
  ex_bicep_curl: 20,
  ex_squat: 115,
  ex_leg_press: 180,
  ex_leg_curl: 70,
  ex_calf_raise: 90,
  ex_chest_press: 70,
  ex_goblet_squat: 35,
  ex_romanian_deadlift: 95,
  ex_lunge: 25,
  ex_glute_bridge: 0,
};

/**
 * Generates realistic workout history for the active routine (default: 8 weeks, 3 sessions/week), running the
 * real start/finish pipeline so recommendations, progression and stats all behave exactly as they would for a user.
 * Refuses to run if any completed workout already exists.
 */
export async function loadDemoData(db: Db, opts: DemoDataOptions): Promise<{ sessions: number }> {
  if ((await sessionRepo.countCompletedSessions(db)) > 0) {
    throw new Error('Sample data can only be loaded into an empty workout history.');
  }
  const routine = await routineRepo.getActiveRoutine(db);
  if (!routine) throw new Error('Activate a routine first.');
  const templates = await routineRepo.getTemplatesForRoutine(db, routine.id);
  if (templates.length === 0) throw new Error('The active routine has no workouts.');
  const prefs = await getPreferences(db);
  const unit: WeightUnit = prefs.weightUnit === 'kg' ? 'kg' : 'lb';
  const weeks = opts.weeks ?? 8;
  const perWeek = Math.min(opts.sessionsPerWeek ?? 3, 6);
  const now = opts.now ?? new Date();
  const trainingDays = [1, 3, 5, 2, 4, 6].slice(0, perWeek).sort();

  // Deterministic pseudo-random so screenshots are reproducible.
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) % 2 ** 31;
    return seed / 2 ** 31;
  };

  const loads = new Map<string, number>();
  let templateIdx = 0;
  let count = 0;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7 * weeks);
  for (let d = new Date(start); d < now; d.setDate(d.getDate() + 1)) {
    if (!trainingDays.includes(d.getDay())) continue;
    if (rand() < 0.08) continue; // the occasional missed day keeps the calendar honest
    const template = templates[templateIdx % templates.length];
    templateIdx += 1;
    if (!template) break;
    const startedAt = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      17 + Math.floor(rand() * 2),
      Math.floor(rand() * 50),
    );
    const readiness = rand() < 0.8 ? 'ready' : rand() < 0.5 ? 'tired' : 'sore';
    const sessionId = await startWorkout(db, {
      templateId: template.id,
      readiness,
      now: startedAt,
      idFactory: opts.idFactory,
    });
    const detail = await sessionRepo.getSessionDetail(db, sessionId);
    if (!detail) continue;

    for (const e of detail.exercises) {
      const type = e.exercise.exerciseType;
      const bodyweight = e.exercise.isBodyweight === 1;
      for (const s of e.sets) {
        if (type === 'cardio') {
          await sessionRepo.updateSet(db, s.id, {
            durationSeconds: 1500 + Math.round(rand() * 600),
            distance: Math.round((2 + rand() * 1.5) * 100) / 100,
            distanceUnit: prefs.distanceUnit,
            completed: 1,
            completedAt: startedAt.toISOString(),
          });
          continue;
        }
        if (type === 'duration') {
          const target = e.targetDurationSeconds ?? 30;
          await sessionRepo.updateSet(db, s.id, {
            durationSeconds: s.durationSeconds ?? target,
            completed: 1,
            completedAt: startedAt.toISOString(),
          });
          continue;
        }
        // strength: use the prefilled (progression-driven) weight, otherwise a plausible starting load
        let weight = s.weight;
        if (!bodyweight && weight === null) {
          const base = loads.get(e.exerciseId) ?? convertWeight(START_LB[e.exerciseId] ?? 40, 'lb', unit);
          weight = roundToStep(base, unit === 'kg' ? 2.5 : 5);
        }
        if (weight !== null) loads.set(e.exerciseId, weight);
        // hit the top of the range most of the time so the double-progression engine advances the load
        const top = e.maxReps;
        const reps = rand() < 0.75 ? top : Math.max(e.minReps, top - 1 - Math.floor(rand() * 2));
        await sessionRepo.updateSet(db, s.id, {
          weight: bodyweight ? null : weight,
          weightUnit: bodyweight ? null : unit,
          actualReps: reps,
          completed: 1,
          completedAt: startedAt.toISOString(),
        });
      }
    }
    const finishedAt = new Date(startedAt.getTime() + (40 + Math.floor(rand() * 20)) * 60_000);
    await finishWorkout(db, sessionId, opts.idFactory, finishedAt);
    count += 1;
  }
  return { sessions: count };
}

export function demoDataSummaryDate(now: Date = new Date()): string {
  return localDate(now);
}

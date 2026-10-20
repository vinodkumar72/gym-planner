import type { Db } from '@/db/types';
import { getTemplateDetail } from '@/db/repositories/routineRepo';
import { estimateDurationMinutes } from '@/domain/analytics/stats';

export interface TemplateInfo {
  id: string;
  name: string;
  routineId: string;
  muscleGroups: string[];
  estimatedMinutes: number;
  exercises: { id: string; name: string; summary: string }[];
}

export function describeTarget(t: {
  targetSets: number;
  minReps: number;
  maxReps: number;
  targetDurationSeconds: number | null;
  exerciseType: string;
}): string {
  if (t.exerciseType === 'cardio') {
    return t.targetDurationSeconds ? `${Math.round(t.targetDurationSeconds / 60)} min` : 'cardio';
  }
  if (t.exerciseType === 'duration') return `${t.targetSets} × ${t.targetDurationSeconds ?? 30}s`;
  return t.minReps === t.maxReps ? `${t.targetSets} × ${t.maxReps}` : `${t.targetSets} × ${t.minReps}–${t.maxReps}`;
}

export async function getTemplateInfo(db: Db, templateId: string): Promise<TemplateInfo | null> {
  const t = await getTemplateDetail(db, templateId);
  if (!t) return null;
  const groups: string[] = [];
  for (const e of t.exercises) {
    const g = e.exercise.primaryMuscleGroup;
    if (!groups.includes(g)) groups.push(g);
  }
  return {
    id: t.id,
    name: t.name,
    routineId: t.routineId,
    muscleGroups: groups,
    estimatedMinutes: estimateDurationMinutes(
      t.exercises.map((e) => ({
        targetSets: e.targetSets,
        restSeconds: e.restSeconds,
        targetDurationSeconds: e.targetDurationSeconds,
        exerciseType: e.exercise.exerciseType,
      })),
    ),
    exercises: t.exercises.map((e) => ({
      id: e.exerciseId,
      name: e.exercise.name,
      summary: describeTarget({ ...e, exerciseType: e.exercise.exerciseType }),
    })),
  };
}

export function titleCase(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

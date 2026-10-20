import { create } from 'zustand';
import { getDb } from '@/db/client';
import * as sessionRepo from '@/db/repositories/sessionRepo';
import type { ExerciseRow, ExerciseSetRow, SessionExerciseRow } from '@/db/schema';
import type { Readiness, WeightUnit } from '@/domain/models/types';
import { abandonWorkout, finishWorkout, getResumableSession, startWorkout, substituteExercise, type FinishSummary } from '@/services/workoutService';
import { newId, nowIso } from '@/utils/ids';

export type ActiveSet = ExerciseSetRow;

export interface ActiveExercise extends SessionExerciseRow {
  exercise: ExerciseRow;
  sets: ActiveSet[];
}

export interface ActiveSession {
  id: string;
  routineId: string | null;
  templateId: string | null;
  templateName: string;
  startedAt: string;
  readiness: Readiness | null;
  notes: string;
}

export interface RestTimer {
  endsAt: number;
  durationSeconds: number;
  sessionExerciseId: string;
}

interface WorkoutState {
  hydrated: boolean;
  session: ActiveSession | null;
  exercises: ActiveExercise[];
  restTimer: RestTimer | null;
  persistError: string | null;
  busy: boolean;

  hydrate: () => Promise<void>;
  start: (templateId: string, readiness: Readiness | null) => Promise<string>;
  resume: (sessionId: string) => Promise<void>;
  updateSet: (sessionExerciseId: string, setId: string, patch: Partial<ActiveSet>) => void;
  toggleSetComplete: (sessionExerciseId: string, setId: string) => void;
  addSet: (sessionExerciseId: string, setType?: 'warmup' | 'working') => void;
  removeSet: (sessionExerciseId: string, setId: string) => void;
  skipExercise: (sessionExerciseId: string) => void;
  unskipExercise: (sessionExerciseId: string) => void;
  substitute: (sessionExerciseId: string, newExerciseId: string) => Promise<void>;
  setExerciseNotes: (sessionExerciseId: string, text: string) => void;
  setSessionNotes: (text: string) => void;
  startRest: (sessionExerciseId: string, seconds: number) => void;
  skipRest: () => void;
  flush: () => Promise<void>;
  finish: () => Promise<FinishSummary>;
  abandon: () => Promise<void>;
  clear: () => void;
}

// ---- serial write queue: guarantees ordering of DB writes from rapid taps ----
let chain: Promise<void> = Promise.resolve();
function enqueue(op: () => Promise<void>, onError: (msg: string) => void): Promise<void> {
  chain = chain
    .then(op)
    .catch(async (e) => {
      try {
        await op();
      } catch (e2) {
        onError(e2 instanceof Error ? e2.message : String(e2 ?? e));
      }
    });
  return chain;
}

const noteTimers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingNotes = new Map<string, () => Promise<void>>();

function debounceNote(key: string, op: () => Promise<void>, onError: (msg: string) => void) {
  const existing = noteTimers.get(key);
  if (existing) clearTimeout(existing);
  pendingNotes.set(key, op);
  noteTimers.set(
    key,
    setTimeout(() => {
      noteTimers.delete(key);
      pendingNotes.delete(key);
      void enqueue(op, onError);
    }, 500),
  );
}

async function flushNotes(onError: (msg: string) => void): Promise<void> {
  for (const [key, t] of noteTimers) {
    clearTimeout(t);
    noteTimers.delete(key);
  }
  const ops = [...pendingNotes.values()];
  pendingNotes.clear();
  for (const op of ops) await enqueue(op, onError);
  await chain;
}

function toActive(detail: sessionRepo.SessionDetail): Pick<WorkoutState, 'session' | 'exercises' | 'restTimer'> {
  const restTimer: RestTimer | null =
    detail.restEndsAt && detail.restEndsAt > Date.now() && detail.restSessionExerciseId
      ? {
          endsAt: detail.restEndsAt,
          durationSeconds: detail.restDurationSeconds ?? 90,
          sessionExerciseId: detail.restSessionExerciseId,
        }
      : null;
  return {
    session: {
      id: detail.id,
      routineId: detail.routineId,
      templateId: detail.templateId,
      templateName: detail.templateNameSnapshot,
      startedAt: detail.startedAt,
      readiness: (detail.readiness as Readiness | null) ?? null,
      notes: detail.notes ?? '',
    },
    exercises: detail.exercises.map((e) => ({ ...e, sets: e.sets })),
    restTimer,
  };
}

export const useWorkoutStore = create<WorkoutState>((set, get) => {
  const fail = (msg: string) => set({ persistError: msg });

  const patchExercise = (sessionExerciseId: string, fn: (e: ActiveExercise) => ActiveExercise) =>
    set((s) => ({ exercises: s.exercises.map((e) => (e.id === sessionExerciseId ? fn(e) : e)) }));

  return {
    hydrated: false,
    session: null,
    exercises: [],
    restTimer: null,
    persistError: null,
    busy: false,

    hydrate: async () => {
      try {
        const detail = await getResumableSession(getDb());
        if (detail) set({ ...toActive(detail), hydrated: true });
        else set({ hydrated: true });
      } catch (e) {
        fail(e instanceof Error ? e.message : String(e));
        set({ hydrated: true });
      }
    },

    start: async (templateId, readiness) => {
      set({ busy: true });
      try {
        const id = await startWorkout(getDb(), { templateId, readiness, idFactory: newId });
        const detail = await sessionRepo.getSessionDetail(getDb(), id);
        if (!detail) throw new Error('Session vanished');
        set({ ...toActive(detail), persistError: null });
        return id;
      } finally {
        set({ busy: false });
      }
    },

    resume: async (sessionId) => {
      const detail = await sessionRepo.getSessionDetail(getDb(), sessionId);
      if (detail && detail.status === 'in_progress') set({ ...toActive(detail), persistError: null });
    },

    updateSet: (sessionExerciseId, setId, patch) => {
      patchExercise(sessionExerciseId, (e) => ({
        ...e,
        sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
      }));
      void enqueue(() => sessionRepo.updateSet(getDb(), setId, patch), fail);
    },

    toggleSetComplete: (sessionExerciseId, setId) => {
      const ex = get().exercises.find((e) => e.id === sessionExerciseId);
      const s = ex?.sets.find((x) => x.id === setId);
      if (!s) return;
      const completed = s.completed === 1 ? 0 : 1;
      const patch: Partial<ActiveSet> = {
        completed,
        completedAt: completed ? nowIso() : null,
        actualReps: completed && s.actualReps === null ? s.targetReps : s.actualReps,
      };
      get().updateSet(sessionExerciseId, setId, patch);
    },

    addSet: (sessionExerciseId, setType = 'working') => {
      const ex = get().exercises.find((e) => e.id === sessionExerciseId);
      if (!ex) return;
      const last = ex.sets[ex.sets.length - 1];
      const row: ActiveSet = {
        id: newId(),
        sessionExerciseId,
        setNumber: ex.sets.length + 1,
        setType,
        targetReps: last?.targetReps ?? null,
        actualReps: last?.actualReps ?? last?.targetReps ?? null,
        weight: last?.weight ?? null,
        weightUnit: last?.weightUnit ?? null,
        durationSeconds: last?.durationSeconds ?? null,
        distance: last?.distance ?? null,
        distanceUnit: last?.distanceUnit ?? null,
        rpe: null,
        rir: null,
        completed: 0,
        completedAt: null,
      };
      patchExercise(sessionExerciseId, (e) => ({ ...e, sets: [...e.sets, row] }));
      void enqueue(() => sessionRepo.insertSet(getDb(), row), fail);
    },

    removeSet: (sessionExerciseId, setId) => {
      patchExercise(sessionExerciseId, (e) => ({
        ...e,
        sets: e.sets.filter((s) => s.id !== setId).map((s, i) => ({ ...s, setNumber: i + 1 })),
      }));
      const after = get().exercises.find((e) => e.id === sessionExerciseId);
      void enqueue(async () => {
        await sessionRepo.deleteSet(getDb(), setId);
        for (const s of after?.sets ?? []) await sessionRepo.updateSet(getDb(), s.id, { setNumber: s.setNumber });
      }, fail);
    },

    skipExercise: (sessionExerciseId) => {
      patchExercise(sessionExerciseId, (e) => ({ ...e, status: 'skipped' }));
      void enqueue(() => sessionRepo.updateSessionExercise(getDb(), sessionExerciseId, { status: 'skipped' }), fail);
    },

    unskipExercise: (sessionExerciseId) => {
      patchExercise(sessionExerciseId, (e) => ({ ...e, status: 'pending' }));
      void enqueue(() => sessionRepo.updateSessionExercise(getDb(), sessionExerciseId, { status: 'pending' }), fail);
    },

    substitute: async (sessionExerciseId, newExerciseId) => {
      const session = get().session;
      if (!session) return;
      await chain;
      await substituteExercise(getDb(), session.id, sessionExerciseId, newExerciseId, newId);
      const detail = await sessionRepo.getSessionDetail(getDb(), session.id);
      if (detail) set({ exercises: toActive(detail).exercises });
    },

    setExerciseNotes: (sessionExerciseId, text) => {
      patchExercise(sessionExerciseId, (e) => ({ ...e, notes: text }));
      debounceNote(`ex:${sessionExerciseId}`, () => sessionRepo.updateSessionExercise(getDb(), sessionExerciseId, { notes: text }), fail);
    },

    setSessionNotes: (text) => {
      const session = get().session;
      if (!session) return;
      set({ session: { ...session, notes: text } });
      debounceNote(`session`, () => sessionRepo.updateSession(getDb(), session.id, { notes: text, updatedAt: nowIso() }), fail);
    },

    startRest: (sessionExerciseId, seconds) => {
      const session = get().session;
      if (!session || seconds <= 0) return;
      const timer: RestTimer = { endsAt: Date.now() + seconds * 1000, durationSeconds: seconds, sessionExerciseId };
      set({ restTimer: timer });
      void enqueue(
        () =>
          sessionRepo.updateSession(getDb(), session.id, {
            restEndsAt: timer.endsAt,
            restDurationSeconds: seconds,
            restSessionExerciseId: sessionExerciseId,
          }),
        fail,
      );
    },

    skipRest: () => {
      const session = get().session;
      set({ restTimer: null });
      if (!session) return;
      void enqueue(
        () => sessionRepo.updateSession(getDb(), session.id, { restEndsAt: null, restDurationSeconds: null, restSessionExerciseId: null }),
        fail,
      );
    },

    flush: async () => {
      await flushNotes(fail);
    },

    finish: async () => {
      const session = get().session;
      if (!session) throw new Error('No active workout');
      set({ busy: true });
      try {
        await flushNotes(fail);
        const summary = await finishWorkout(getDb(), session.id, newId);
        set({ session: null, exercises: [], restTimer: null, persistError: null });
        return summary;
      } finally {
        set({ busy: false });
      }
    },

    abandon: async () => {
      const session = get().session;
      if (!session) return;
      await flushNotes(fail);
      await abandonWorkout(getDb(), session.id);
      set({ session: null, exercises: [], restTimer: null });
    },

    clear: () => set({ session: null, exercises: [], restTimer: null }),
  };
});

export function sessionVolume(exercises: ActiveExercise[], unit: WeightUnit): number {
  let v = 0;
  for (const e of exercises) {
    for (const s of e.sets) {
      if (s.completed === 1 && s.weight !== null && s.actualReps !== null) {
        const w = s.weightUnit && s.weightUnit !== unit ? (unit === 'kg' ? s.weight * 0.45359237 : s.weight / 0.45359237) : s.weight;
        v += w * s.actualReps;
      }
    }
  }
  return Math.round(v);
}

import { create } from 'zustand';
import type { UserPreferencesRow } from '@/db/schema';
import type { Readiness, ThemePreference, WeightUnit } from '@/domain/models/types';
import { getDb } from '@/db/client';
import { getPreferences, updatePreferences } from '@/db/repositories/preferencesRepo';
import { localDate } from '@/domain/workout-engine';

interface AppState {
  ready: boolean;
  preferences: UserPreferencesRow | null;
  /** today's readiness check-in (in memory; reset when the date changes) */
  readiness: Readiness | null;
  readinessDate: string | null;
  /** bumped after any write that screens should react to */
  dataVersion: number;
  error: string | null;

  load: () => Promise<void>;
  setPreferences: (patch: Partial<Omit<UserPreferencesRow, 'id' | 'createdAt'>>) => Promise<void>;
  setReadiness: (r: Readiness | null, now?: Date) => void;
  getReadiness: (now?: Date) => Readiness | null;
  bump: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  preferences: null,
  readiness: null,
  readinessDate: null,
  dataVersion: 0,
  error: null,

  load: async () => {
    try {
      const prefs = await getPreferences(getDb());
      set({ preferences: prefs, ready: true, error: null });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : String(e), ready: true });
    }
  },

  setPreferences: async (patch) => {
    const prefs = await updatePreferences(getDb(), patch);
    set({ preferences: prefs, dataVersion: get().dataVersion + 1 });
  },

  setReadiness: (r, now = new Date()) => set({ readiness: r, readinessDate: localDate(now) }),

  getReadiness: (now = new Date()) => {
    const { readiness, readinessDate } = get();
    return readinessDate === localDate(now) ? readiness : null;
  },

  bump: () => set({ dataVersion: get().dataVersion + 1 }),
}));

export function useWeightUnit(): WeightUnit {
  return useAppStore((s) => (s.preferences?.weightUnit === 'kg' ? 'kg' : 'lb'));
}

export function useThemePreference(): ThemePreference {
  return useAppStore((s) => (s.preferences?.theme as ThemePreference | undefined) ?? 'system');
}

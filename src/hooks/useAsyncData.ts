import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAppStore } from '@/stores/appStore';

export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

/**
 * Loads data from the database when the screen is focused and whenever `dataVersion` changes.
 * `fn` must be memoised by the caller (useCallback) — its identity drives reloads.
 */
export function useAsyncData<T>(fn: () => Promise<T>, _deps: unknown[] = []): AsyncData<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const dataVersion = useAppStore((s) => s.dataVersion);
  const [tick, setTick] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    fn()
      .then((d) => {
        if (!cancelled && alive.current) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled && alive.current) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled && alive.current) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // dataVersion and tick are intentional triggers: any store write or manual reload re-runs the query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, dataVersion, tick]);

  useFocusEffect(run);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, loading, error, reload };
}

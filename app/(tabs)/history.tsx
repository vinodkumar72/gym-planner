import React, { useCallback, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { Card, Chip, ListRow, Screen, Section, Text } from '@/components/common';
import { MonthCalendar } from '@/components/charts/MonthCalendar';
import { getDb } from '@/db/client';
import { useAsyncData } from '@/hooks/useAsyncData';
import { recentSessions, sessionsForMonth } from '@/services/historyService';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDuration } from '@/utils/units';

export default function HistoryScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const now = new Date();
  const [ym, setYm] = useState({ year: now.getFullYear(), month0: now.getMonth() });
  const [selected, setSelected] = useState<string | null>(null);
  const load = useCallback(async () => {
    const db = getDb();
    return { month: await sessionsForMonth(db, ym.year, ym.month0), recent: await recentSessions(db, 30) };
  }, [ym]);
  const { data } = useAsyncData(load, [ym]);
  const marks = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of data?.month ?? []) if (s.status === 'completed') m.set(s.localDate, (m.get(s.localDate) ?? 0) + 1);
    return m;
  }, [data]);
  const list = selected ? (data?.month ?? []).filter((s) => s.localDate === selected) : (data?.recent ?? []);

  return (
    <Screen title="History" testID="history-screen">
      <Card>
        <MonthCalendar year={ym.year} month0={ym.month0} marks={marks} selected={selected} onSelect={(d) => setSelected(selected === d ? null : d)} onChangeMonth={(year, month0) => { setYm({ year, month0 }); setSelected(null); }} />
      </Card>
      <Section title={selected ? `Workouts on ${selected}` : 'Recent workouts'}>
        {list.length === 0 ? <Text tone="muted">{selected ? 'No workouts this day.' : 'No workouts yet.'}</Text> : null}
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {list.map((s, i) => (
            <ListRow
              key={s.id}
              title={s.templateNameSnapshot || 'Workout'}
              subtitle={`${new Date(s.startedAt).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} · ${formatDuration(s.durationSeconds)}`}
              right={s.status === 'abandoned' ? <Chip label="Abandoned" small tone="warning" /> : undefined}
              onPress={() => router.push(`/history/${s.id}`)}
              chevron
              last={i === list.length - 1}
              testID={`history-${s.id}`}
            />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

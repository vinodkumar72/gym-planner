import React, { useCallback } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Card, ListRow, Screen, Section, Text } from '@/components/common';
import { BarChart } from '@/components/charts/BarChart';
import { getDb } from '@/db/client';
import { useAsyncData } from '@/hooks/useAsyncData';
import { progressOverview } from '@/services/historyService';
import { titleCase } from '@/services/templateInfo';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function ProgressScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const { width } = useWindowDimensions();
  const target = useAppStore((s) => s.preferences?.trainingDaysPerWeek ?? 3);
  const load = useCallback(() => progressOverview(getDb(), new Date(), 8), []);
  const { data } = useAsyncData(load, []);
  const chartW = width - spacing.lg * 4;

  return (
    <Screen title="Progress" testID="progress-screen">
      <View style={[styles.row, { gap: spacing.md }]}>
        <Card style={styles.stat}>
          <Text variant="heading">{data?.totalSessions ?? 0}</Text>
          <Text variant="caption" tone="muted">
            workouts
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="heading">{data?.streaks.currentWeekStreak ?? 0}</Text>
          <Text variant="caption" tone="muted">
            week streak
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="heading">{data?.streaks.longestWeekStreak ?? 0}</Text>
          <Text variant="caption" tone="muted">
            best streak
          </Text>
        </Card>
      </View>
      <Section title={`Workouts per week (target ${target})`}>
        <Card>
          {data ? (
            <BarChart
              width={chartW}
              target={target}
              points={data.weekly.map((w, i) => ({ label: w.weekStart.slice(5), value: w.sessions, highlight: i === data.weekly.length - 1 }))}
            />
          ) : null}
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            {data?.streaks.daysSinceLast === null || data?.streaks.daysSinceLast === undefined ? 'No workouts logged yet.' : `Last workout ${data.streaks.daysSinceLast} day${data.streaks.daysSinceLast === 1 ? '' : 's'} ago.`}
          </Text>
        </Card>
      </Section>
      <Section title={`Estimated volume per week (${data?.volumeUnit ?? 'lb'})`}>
        <Card>
          {data ? <BarChart width={chartW} points={data.weekly.map((w, i) => ({ label: w.weekStart.slice(5), value: Math.round(w.volume / 1000), highlight: i === data.weekly.length - 1 }))} /> : null}
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            Thousands of {data?.volumeUnit ?? 'lb'} (weight × reps of completed working sets). Estimated; bodyweight and cardio sets are excluded.
          </Text>
        </Card>
      </Section>
      {data && data.muscleGroupSets.length > 0 ? (
        <Section title="Sets by muscle group (8 weeks)">
          <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
            {data.muscleGroupSets.map((m, i) => (
              <ListRow key={m.group} title={titleCase(m.group)} right={<Text weight="semibold">{m.sets}</Text>} last={i === data.muscleGroupSets.length - 1} />
            ))}
          </Card>
        </Section>
      ) : null}
      <Section title="Exercise trends">
        {data && data.trainedExercises.length === 0 ? <Text tone="muted">Complete a workout to see trends and records.</Text> : null}
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {data?.trainedExercises.map((t, i) => (
            <ListRow key={t.exercise.id} title={t.exercise.name} subtitle={`${t.sessions} session${t.sessions === 1 ? '' : 's'} · last ${t.lastDate}`} onPress={() => router.push(`/progress/exercise/${t.exercise.id}`)} chevron last={i === data.trainedExercises.length - 1} />
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row' }, stat: { flex: 1, alignItems: 'center', gap: 2 } });

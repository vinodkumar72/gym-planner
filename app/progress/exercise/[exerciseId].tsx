import React, { useCallback, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card, Chip, ChipRow, Screen, Section, Text } from '@/components/common';
import { LineChart } from '@/components/charts/LineChart';
import { getDb } from '@/db/client';
import { useAsyncData } from '@/hooks/useAsyncData';
import { exerciseProgress } from '@/services/historyService';
import { useTheme } from '@/theme/ThemeProvider';
import { formatWeight } from '@/utils/units';

type Metric = 'topWeight' | 'est1rm' | 'volume';

export default function ExerciseProgressScreen() {
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { spacing } = useTheme();
  const { width } = useWindowDimensions();
  const [metric, setMetric] = useState<Metric>('topWeight');
  const load = useCallback(() => exerciseProgress(getDb(), exerciseId), [exerciseId]);
  const { data } = useAsyncData(load, [exerciseId]);
  if (!data) {
    return (
      <Screen title="Progress">
        <Text tone="muted">Loading…</Text>
      </Screen>
    );
  }
  const pr = data.records;
  const points = data.trend.map((p) => ({ label: p.localDate.slice(5), value: p[metric] }));
  const unit = metric === 'volume' ? '' : ` ${data.unit}`;
  return (
    <Screen title={data.exercise.name} subtitle="Completed working sets only">
      <ChipRow>
        <Chip label="Top weight" selected={metric === 'topWeight'} onPress={() => setMetric('topWeight')} small />
        <Chip label="Est. 1RM" selected={metric === 'est1rm'} onPress={() => setMetric('est1rm')} small />
        <Chip label="Volume" selected={metric === 'volume'} onPress={() => setMetric('volume')} small />
      </ChipRow>
      <Card style={{ marginTop: spacing.md }}>
        <LineChart points={points} width={width - spacing.lg * 4} unit={unit} />
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          {metric === 'est1rm' ? 'Estimated one-rep max (Epley formula). An estimate, not a tested max.' : metric === 'volume' ? `Weight × reps per session (${data.unit}).` : `Heaviest completed set per session (${data.unit}).`}
        </Text>
      </Card>
      <Section title="Personal records">
        <Card>
          {pr.bestWeight ? <Text>Heaviest: {formatWeight(pr.bestWeight.weight, data.unit)} × {pr.bestWeight.reps} on {pr.bestWeight.localDate}</Text> : null}
          {pr.bestEst1rm ? <Text>Best est. 1RM: {formatWeight(pr.bestEst1rm.value, data.unit)} ({pr.bestEst1rm.weight} × {pr.bestEst1rm.reps})</Text> : null}
          {pr.bestReps ? <Text>Most reps in a set: {pr.bestReps.reps}{pr.bestReps.weight ? ` at ${formatWeight(pr.bestReps.weight, data.unit)}` : ''}</Text> : null}
          {pr.bestDuration ? <Text>Longest hold: {pr.bestDuration.seconds}s</Text> : null}
          {!pr.bestWeight && !pr.bestReps && !pr.bestDuration ? <Text tone="muted">No records yet.</Text> : null}
        </Card>
      </Section>
      <Section title="Sessions">
        <Card>
          {data.trend.length === 0 ? <Text tone="muted">No completed sessions.</Text> : null}
          {[...data.trend].reverse().slice(0, 15).map((p) => (
            <Text key={p.localDate + p.topWeight} variant="caption" style={{ marginBottom: 2 }}>
              {p.localDate}: {formatWeight(p.topWeight, data.unit)} × {p.topReps} · est 1RM {p.est1rm} · vol {p.volume}
            </Text>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

import React, { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Trophy } from 'lucide-react-native';
import { Button, Card, Chip, Screen, Section, Text } from '@/components/common';
import { getDb } from '@/db/client';
import { getRecommendationsForSession, getSessionDetail } from '@/db/repositories/sessionRepo';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useWeightUnit } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';
import { convertWeight, formatDuration, formatWeight, roundTo } from '@/utils/units';
import type { WeightUnit } from '@/domain/models/types';

export default function WorkoutSummaryScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors, spacing } = useTheme();
  const unit = useWeightUnit();
  const load = useCallback(async () => {
    const db = getDb();
    const detail = await getSessionDetail(db, sessionId);
    const recos = await getRecommendationsForSession(db, sessionId);
    return { detail, recos };
  }, [sessionId]);
  const { data } = useAsyncData(load, [sessionId]);
  const detail = data?.detail;

  let sets = 0;
  let volume = 0;
  for (const e of detail?.exercises ?? []) {
    for (const s of e.sets) {
      if (s.completed !== 1) continue;
      sets += 1;
      if (s.weight !== null && s.actualReps !== null) volume += convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? unit, unit) * s.actualReps;
    }
  }

  return (
    <Screen title="Workout complete" subtitle={detail?.templateNameSnapshot} testID="workout-summary" back={false}>
      <View style={[styles.row, { gap: spacing.md }]}>
        <Card style={styles.stat}>
          <Text variant="heading">{formatDuration(detail?.durationSeconds)}</Text>
          <Text variant="caption" tone="muted">
            duration
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="heading">{sets}</Text>
          <Text variant="caption" tone="muted">
            sets
          </Text>
        </Card>
        <Card style={styles.stat}>
          <Text variant="heading">{roundTo(volume, 0).toLocaleString()}</Text>
          <Text variant="caption" tone="muted">
            {unit} volume
          </Text>
        </Card>
      </View>

      <Section title="Next time">
        {(data?.recos ?? []).length === 0 ? <Text tone="muted">No completed exercises to review.</Text> : null}
        {data?.recos.map((r) => {
          const ex = detail?.exercises.find((e) => e.exerciseId === r.exerciseId);
          const tone = r.action === 'increase' ? 'success' : r.action === 'decrease' ? 'warning' : r.action === 'review' ? 'primary' : 'default';
          return (
            <Card key={r.id} style={{ marginBottom: spacing.sm }}>
              <View style={[styles.row, { justifyContent: 'space-between' }]}>
                <Text weight="semibold">{ex?.exercise.name ?? r.exerciseId}</Text>
                <Chip label={r.action} small tone={tone} />
              </View>
              {r.suggestedWeight !== null && r.suggestedWeightUnit ? (
                <View style={[styles.row, { gap: 6, marginTop: 4 }]}>
                  {r.action === 'increase' ? <Trophy size={14} color={colors.success} /> : null}
                  <Text variant="caption" weight="semibold">
                    {formatWeight(r.suggestedWeight, r.suggestedWeightUnit as WeightUnit)}
                  </Text>
                </View>
              ) : null}
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {r.explanation}
              </Text>
            </Card>
          );
        })}
      </Section>

      <Button title="Done" size="lg" fullWidth onPress={() => router.replace('/(tabs)/today')} style={{ marginTop: spacing.xl }} testID="summary-done" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
});

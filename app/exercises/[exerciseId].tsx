import React, { useCallback } from 'react';
import { Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, Screen, Section, Text } from '@/components/common';
import { getDb } from '@/db/client';
import { getExercise, setExerciseArchived } from '@/db/repositories/exerciseRepo';
import { useAsyncData } from '@/hooks/useAsyncData';
import { exerciseProgress } from '@/services/historyService';
import { titleCase } from '@/services/templateInfo';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';
import { formatWeight } from '@/utils/units';
import { nowIso } from '@/utils/ids';

export default function ExerciseDetailScreen() {
  const router = useRouter();
  const { exerciseId } = useLocalSearchParams<{ exerciseId: string }>();
  const { spacing } = useTheme();
  const bump = useAppStore((s) => s.bump);
  const load = useCallback(async () => {
    const db = getDb();
    return { exercise: await getExercise(db, exerciseId), progress: await exerciseProgress(db, exerciseId) };
  }, [exerciseId]);
  const { data } = useAsyncData(load, [exerciseId]);
  const ex = data?.exercise;
  if (!ex) {
    return (
      <Screen title="Exercise">
        <Text tone="muted">Loading…</Text>
      </Screen>
    );
  }
  let secondary: string[] = [];
  try {
    secondary = JSON.parse(ex.secondaryMuscleGroups) as string[];
  } catch {
    secondary = [];
  }
  const pr = data?.progress?.records;
  const archiveToggle = () => {
    const archived = ex.isArchived === 1;
    Alert.alert(archived ? 'Unarchive exercise?' : 'Archive exercise?', archived ? 'It will show in the library again.' : 'It will be hidden from the library. History is kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: archived ? 'Unarchive' : 'Archive', onPress: async () => { await setExerciseArchived(getDb(), ex.id, !archived, nowIso()); bump(); router.back(); } },
    ]);
  };

  return (
    <Screen title={ex.name} subtitle={`${titleCase(ex.primaryMuscleGroup)} · ${titleCase(ex.equipment)}`}>
      <ChipRow>
        <Chip label={ex.exerciseType === 'duration' ? 'Timed' : titleCase(ex.exerciseType)} small />
        {ex.isBodyweight ? <Chip label="Bodyweight" small /> : null}
        {ex.isCustom ? <Chip label="Custom" small tone="primary" /> : null}
        {secondary.map((s) => (
          <Chip key={s} label={titleCase(s)} small />
        ))}
      </ChipRow>
      {ex.instructions ? (
        <Text tone="muted" style={{ marginTop: spacing.md }}>
          {ex.instructions}
        </Text>
      ) : null}
      <Section title="Personal records">
        {!pr || (!pr.bestWeight && !pr.bestReps && !pr.bestDuration) ? (
          <Text tone="muted">No completed sets yet.</Text>
        ) : (
          <Card>
            {pr.bestWeight ? <Text>Heaviest: {formatWeight(pr.bestWeight.weight, data?.progress?.unit ?? 'lb')} × {pr.bestWeight.reps} ({pr.bestWeight.localDate})</Text> : null}
            {pr.bestEst1rm ? <Text>Est. 1RM: {formatWeight(pr.bestEst1rm.value, data?.progress?.unit ?? 'lb')} (estimate)</Text> : null}
            {pr.bestReps ? <Text>Most reps: {pr.bestReps.reps} ({pr.bestReps.localDate})</Text> : null}
            {pr.bestDuration ? <Text>Longest: {pr.bestDuration.seconds}s ({pr.bestDuration.localDate})</Text> : null}
          </Card>
        )}
      </Section>
      <Button title="View progress chart" variant="secondary" onPress={() => router.push(`/progress/exercise/${ex.id}`)} style={{ marginTop: spacing.lg }} />
      <Button title={ex.isArchived ? 'Unarchive' : 'Archive exercise'} variant="ghost" onPress={archiveToggle} style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

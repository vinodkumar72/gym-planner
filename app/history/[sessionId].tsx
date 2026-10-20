import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Chip, Screen, Section, Sheet, Text, TextField } from '@/components/common';
import { getDb } from '@/db/client';
import { getRecommendationsForSession, getSessionDetail, updateSession } from '@/db/repositories/sessionRepo';
import type { WeightUnit } from '@/domain/models/types';
import { useAsyncData } from '@/hooks/useAsyncData';
import { deleteSessionPermanently } from '@/services/historyService';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDuration, formatWeight } from '@/utils/units';
import { nowIso } from '@/utils/ids';

export default function SessionDetailScreen() {
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { spacing } = useTheme();
  const bump = useAppStore((s) => s.bump);
  const load = useCallback(async () => {
    const db = getDb();
    return { detail: await getSessionDetail(db, sessionId), recos: await getRecommendationsForSession(db, sessionId) };
  }, [sessionId]);
  const { data } = useAsyncData(load, [sessionId]);
  const [editNotes, setEditNotes] = useState(false);
  const [notes, setNotes] = useState('');
  const d = data?.detail;
  if (!d) {
    return (
      <Screen title="Workout">
        <Text tone="muted">Loading…</Text>
      </Screen>
    );
  }
  const remove = () => {
    Alert.alert('Delete this workout?', 'This permanently removes the session and its sets. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteSessionPermanently(getDb(), d.id); bump(); router.back(); } },
    ]);
  };

  return (
    <Screen title={d.templateNameSnapshot || 'Workout'} subtitle={`${new Date(d.startedAt).toLocaleString()} · ${formatDuration(d.durationSeconds)}`}>
      <View style={[styles.row, { gap: spacing.sm }]}>
        <Chip label={d.status} small tone={d.status === 'completed' ? 'success' : 'warning'} />
        {d.readiness ? <Chip label={`Felt ${d.readiness}`} small /> : null}
        {d.routineNameSnapshot ? <Chip label={d.routineNameSnapshot} small /> : null}
      </View>
      {d.exercises.map((e) => {
        const reco = data?.recos.find((r) => r.exerciseId === e.exerciseId);
        return (
          <Card key={e.id} style={{ marginTop: spacing.md }}>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text variant="subheading">{e.exerciseNameSnapshot || e.exercise.name}</Text>
              {e.status !== 'completed' ? <Chip label={e.status} small tone="warning" /> : null}
            </View>
            {e.substitutedFromExerciseId ? (
              <Text variant="caption" tone="muted">
                substituted in
              </Text>
            ) : null}
            {e.sets.map((s) => (
              <Text key={s.id} tone={s.completed ? 'default' : 'muted'} style={{ marginTop: 2 }}>
                {s.setType === 'warmup' ? 'W' : s.setNumber}.{' '}
                {s.weight !== null ? `${formatWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? 'lb')} × ` : ''}
                {s.actualReps !== null ? `${s.actualReps} reps` : ''}
                {s.durationSeconds !== null ? formatDuration(s.durationSeconds) : ''}
                {s.distance !== null ? ` · ${s.distance} ${s.distanceUnit ?? ''}` : ''}
                {s.rpe !== null ? ` · RPE ${s.rpe}` : ''}
                {!s.completed ? ' (not completed)' : ''}
              </Text>
            ))}
            {e.notes ? (
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
                Note: {e.notes}
              </Text>
            ) : null}
            {reco ? (
              <Text variant="caption" tone="primary" style={{ marginTop: spacing.xs }}>
                Next: {reco.explanation}
              </Text>
            ) : null}
          </Card>
        );
      })}
      <Section title="Notes" right={<Button title="Edit" variant="ghost" size="sm" onPress={() => { setNotes(d.notes ?? ''); setEditNotes(true); }} />}>
        <Text tone={d.notes ? 'default' : 'muted'}>{d.notes || 'No notes.'}</Text>
      </Section>
      <Button title="Delete workout" variant="ghost" onPress={remove} style={{ marginTop: spacing.xl }} />
      <Sheet visible={editNotes} onClose={() => setEditNotes(false)} title="Workout notes">
        <TextField value={notes} onChangeText={setNotes} multiline autoFocus />
        <Button title="Save" onPress={async () => { await updateSession(getDb(), d.id, { notes, updatedAt: nowIso() }); setEditNotes(false); bump(); }} style={{ marginTop: spacing.md }} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' } });

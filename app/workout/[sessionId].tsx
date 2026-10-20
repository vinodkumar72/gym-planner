import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useKeepAwake } from 'expo-keep-awake';
import { X } from 'lucide-react-native';
import { Button, Text, TextField, Sheet } from '@/components/common';
import { MAX_CONTENT_WIDTH } from '@/components/common/Screen';
import { ExercisePicker } from '@/components/exercise/ExercisePicker';
import { ExerciseCard } from '@/components/workout/ExerciseCard';
import { RestTimerBar } from '@/components/workout/RestTimerBar';
import { getDb } from '@/db/client';
import type { ExerciseRow } from '@/db/schema';
import type { ProgressionResult } from '@/domain/progression';
import type { ExercisePerformance } from '@/db/repositories/sessionRepo';
import { getExerciseSuggestion } from '@/services/recommendationService';
import { scheduleRestNotification, cancelRestNotification } from '@/services/notificationService';
import { useAppStore, useWeightUnit } from '@/stores/appStore';
import { useWorkoutStore, type ActiveExercise } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { formatClock } from '@/utils/units';

type Suggestion = { result: ProgressionResult; last: ExercisePerformance | null };

export default function ActiveWorkoutScreen() {
  useKeepAwake();
  const router = useRouter();
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const { colors, spacing } = useTheme();
  const insets = useScreenInsets();
  const unit = useWeightUnit();
  const bump = useAppStore((s) => s.bump);
  const store = useWorkoutStore();
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({});
  const [substituting, setSubstituting] = useState<string | null>(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Resume if the store is empty (e.g. app relaunched directly into this route).
  useEffect(() => {
    if (!store.session && sessionId) void store.resume(sessionId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const session = store.session;
  const exercises = store.exercises;

  // Suggestions + last performance for each exercise, computed once per exercise id.
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, Suggestion> = {};
      for (const e of exercises) {
        if (suggestions[e.id]) {
          next[e.id] = suggestions[e.id] as Suggestion;
          continue;
        }
        const s = await getExerciseSuggestion(getDb(), e.exercise, e, session.readiness, {
          excludeSessionId: session.id,
          displayUnit: unit,
        });
        next[e.id] = { result: s.result, last: s.lastPerformance };
      }
      if (!cancelled) setSuggestions(next);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, exercises.length]);

  useEffect(() => {
    if (!session) return;
    const tick = () => setElapsed(Math.floor((Date.now() - new Date(session.startedAt).getTime()) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session]);

  // Flush debounced notes when the app goes to background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void store.flush();
    });
    return () => sub.remove();
  }, [store]);

  // Local notification when the rest timer ends (only if the user enabled notifications).
  useEffect(() => {
    if (store.restTimer) void scheduleRestNotification(store.restTimer.endsAt);
    else void cancelRestNotification();
  }, [store.restTimer]);

  const onToggle = useCallback(
    (ex: ActiveExercise, setId: string) => {
      const wasDone = ex.sets.find((s) => s.id === setId)?.completed === 1;
      store.toggleSetComplete(ex.id, setId);
      if (!wasDone && ex.restSeconds > 0) store.startRest(ex.id, ex.restSeconds);
    },
    [store],
  );

  const finish = () => {
    // Read the latest state directly so the handler never acts on a stale closure.
    const latest = useWorkoutStore.getState();
    if (!latest.session || latest.busy) return;
    const incomplete = latest.exercises.filter(
      (e) => e.status === 'pending' && !e.sets.some((s) => s.completed === 1),
    ).length;
    const go = async () => {
      try {
        const summary = await useWorkoutStore.getState().finish();
        bump();
        router.replace(`/workout/summary/${summary.sessionId}`);
      } catch (e) {
        Alert.alert('Could not finish', e instanceof Error ? e.message : String(e));
      }
    };
    if (incomplete > 0) {
      Alert.alert(
        'Finish workout?',
        `${incomplete} exercise${incomplete > 1 ? 's have' : ' has'} no completed sets and will be marked skipped.`,
        [
          { text: 'Keep going', style: 'cancel' },
          { text: 'Finish', onPress: () => void go() },
        ],
      );
    } else void go();
  };

  const discard = () => {
    Alert.alert('Discard workout?', 'This session will be marked abandoned. Nothing else is deleted.', [
      { text: 'Keep going', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: async () => {
          await store.abandon();
          bump();
          router.back();
        },
      },
    ]);
  };

  const header = (
    <View
      style={[
        styles.header,
        { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomColor: colors.border },
      ]}
      testID="workout-header"
    >
      <Pressable
        onPress={() => router.back()}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Minimise workout"
      >
        <X size={24} color={colors.textMuted} />
      </Pressable>
      <View style={styles.headerText}>
        <Text variant="label" tone="muted">
          Today
        </Text>
        <Text variant="heading">{session?.templateName ?? 'Workout'}</Text>
      </View>
      <Text
        variant="caption"
        tone="muted"
        style={{ marginRight: spacing.md }}
        accessibilityLabel={`Elapsed ${formatClock(elapsed)}`}
      >
        {formatClock(elapsed)}
      </Text>
      <Button
        title="Finish"
        size="sm"
        variant="success"
        onPress={finish}
        loading={store.busy}
        testID="finish-workout"
      />
    </View>
  );

  if (!session) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.center}>
          <Text tone="muted">Loading workout…</Text>
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
    );
  }

  return (
    <View
      style={[styles.flex, { backgroundColor: colors.background, paddingTop: insets.top }]}
      testID="active-workout"
    >
      {header}
      {store.persistError ? (
        <View style={{ backgroundColor: colors.dangerMuted, padding: spacing.sm }}>
          <Text variant="caption" tone="danger" center>
            Saving failed: {store.persistError}. Your entries are kept in memory; finishing will retry.
          </Text>
        </View>
      ) : null}
      <FlatList
        data={exercises}
        keyExtractor={(e) => e.id}
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 140 + insets.bottom,
          width: '100%',
          maxWidth: MAX_CONTENT_WIDTH,
          alignSelf: 'center',
        }}
        keyboardShouldPersistTaps="handled"
        removeClippedSubviews={false}
        renderItem={({ item }) => (
          <ExerciseCard
            exercise={item}
            unit={unit}
            suggestion={suggestions[item.id]}
            onSetChange={(setId, patch) => store.updateSet(item.id, setId, patch)}
            onToggleSet={(setId) => onToggle(item, setId)}
            onAddSet={(type) => store.addSet(item.id, type)}
            onRemoveSet={(setId) => store.removeSet(item.id, setId)}
            onSkip={() => store.skipExercise(item.id)}
            onUnskip={() => store.unskipExercise(item.id)}
            onSubstitute={() => setSubstituting(item.id)}
            onNotes={(t) => store.setExerciseNotes(item.id, t)}
          />
        )}
        ListFooterComponent={
          <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
            <Button
              title={session.notes ? 'Edit workout note' : 'Add workout note'}
              variant="secondary"
              fullWidth
              onPress={() => setNotesOpen(true)}
            />
            <Button title="Discard workout" variant="ghost" fullWidth onPress={discard} />
          </View>
        }
      />
      {store.restTimer ? (
        <View
          style={[styles.timerWrap, { bottom: spacing.lg + insets.bottom, paddingHorizontal: spacing.lg }]}
        >
          <RestTimerBar
            timer={store.restTimer}
            onSkip={store.skipRest}
            onExtend={(s) =>
              store.startRest(
                store.restTimer!.sessionExerciseId,
                Math.max(0, Math.ceil((store.restTimer!.endsAt - Date.now()) / 1000)) + s,
              )
            }
          />
        </View>
      ) : null}

      <ExercisePicker
        visible={substituting !== null}
        onClose={() => setSubstituting(null)}
        title="Substitute with"
        onSelect={async (ex: ExerciseRow) => {
          const id = substituting;
          setSubstituting(null);
          if (id) await store.substitute(id, ex.id);
        }}
      />
      <Sheet visible={notesOpen} onClose={() => setNotesOpen(false)} title="Workout note">
        <TextField
          value={session.notes}
          onChangeText={store.setSessionNotes}
          placeholder="How did it go?"
          multiline
          autoFocus
        />
        <Button title="Done" onPress={() => setNotesOpen(false)} style={{ marginTop: spacing.md }} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1 },
  timerWrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
});

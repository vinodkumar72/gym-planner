import React, { memo, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { MoreVertical, Plus } from 'lucide-react-native';
import { Button, Card, Chip, Sheet, Text, TextField } from '@/components/common';
import { exerciseKind, type WeightUnit } from '@/domain/models/types';
import type { ProgressionResult } from '@/domain/progression';
import type { ExercisePerformance } from '@/db/repositories/sessionRepo';
import type { ActiveExercise, ActiveSet } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';
import { convertWeight, formatDuration, formatWeight, roundTo, stepperStep } from '@/utils/units';
import { describeTarget } from '@/services/templateInfo';
import { SetRow } from './SetRow';

export interface ExerciseCardProps {
  exercise: ActiveExercise;
  unit: WeightUnit;
  suggestion?: { result: ProgressionResult; last: ExercisePerformance | null };
  onSetChange: (setId: string, patch: Partial<ActiveSet>) => void;
  onToggleSet: (setId: string) => void;
  onAddSet: (type: 'warmup' | 'working') => void;
  onRemoveSet: (setId: string) => void;
  onSkip: () => void;
  onUnskip: () => void;
  onSubstitute: () => void;
  onNotes: (text: string) => void;
}

function lastLine(
  last: ExercisePerformance | null,
  unit: WeightUnit,
  kind: ReturnType<typeof exerciseKind>,
): string | null {
  if (!last) return null;
  const working = last.sets.filter((s) => s.setType === 'working' && s.completed === 1);
  if (working.length === 0) return null;
  if (kind === 'timed') return working.map((s) => formatDuration(s.durationSeconds)).join(' · ');
  if (kind === 'cardio') {
    const s = working[0];
    return `${formatDuration(s?.durationSeconds)}${s?.distance ? ` · ${s.distance} ${s.distanceUnit ?? ''}` : ''}`;
  }
  return working
    .map((s) => {
      const w =
        s.weight === null
          ? null
          : roundTo(convertWeight(s.weight, (s.weightUnit as WeightUnit | null) ?? unit, unit), 2);
      return w === null ? `${s.actualReps ?? 0}` : `${w}×${s.actualReps ?? 0}`;
    })
    .join('  ');
}

function ExerciseCardInner(p: ExerciseCardProps) {
  const { colors, spacing } = useTheme();
  const [menu, setMenu] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const { exercise } = p;
  const kind = exerciseKind(exercise.exercise.exerciseType, exercise.exercise.isBodyweight);
  const skipped = exercise.status === 'skipped';
  const substituted = exercise.status === 'substituted';
  const done = exercise.sets.filter((s) => s.completed === 1).length;
  const weightStep = stepperStep(
    exercise.progressionIncrement,
    exercise.incrementUnit === 'kg' ? 'kg' : 'lb',
    p.unit,
  );
  const last = p.suggestion ? lastLine(p.suggestion.last, p.unit, kind) : null;
  const res = p.suggestion?.result;
  const actionTone =
    res?.action === 'increase'
      ? 'success'
      : res?.action === 'decrease'
        ? 'warning'
        : res?.action === 'review'
          ? 'primary'
          : 'default';
  const presc = res?.prescription;
  const suggestedText =
    presc?.kind === 'weighted' && presc.weight !== null
      ? formatWeight(presc.weight, presc.unit)
      : presc?.kind === 'bodyweight' && presc.targetReps !== null
        ? `${presc.targetReps} reps`
        : presc?.kind === 'timed' && presc.durationSeconds !== null
          ? formatDuration(presc.durationSeconds)
          : null;

  if (substituted) {
    return (
      <Card style={{ marginBottom: spacing.md, opacity: 0.6 }}>
        <Text tone="muted">{exercise.exerciseNameSnapshot} — substituted</Text>
      </Card>
    );
  }

  return (
    <Card style={{ marginBottom: spacing.md, opacity: skipped ? 0.6 : 1 }} testID={`exercise-${exercise.id}`}>
      <View style={styles.head}>
        <View style={styles.flex}>
          <Text variant="subheading">{exercise.exercise.name}</Text>
          <Text variant="caption" tone="muted">
            Target {describeTarget({ ...exercise, exerciseType: exercise.exercise.exerciseType })}
            {exercise.restSeconds ? ` · rest ${formatDuration(exercise.restSeconds)}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => setMenu(true)}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={`Options for ${exercise.exercise.name}`}
          testID={`exercise-${exercise.id}-menu`}
        >
          <MoreVertical size={22} color={colors.textMuted} />
        </Pressable>
      </View>

      {last || suggestedText ? (
        <View
          style={[
            styles.info,
            {
              backgroundColor: colors.background,
              marginTop: spacing.sm,
              padding: spacing.sm,
              borderRadius: 10,
              gap: 2,
            },
          ]}
        >
          {last ? (
            <Text variant="caption" tone="muted">
              Last time: {last}
            </Text>
          ) : null}
          {res ? (
            <View style={[styles.row, { gap: spacing.sm }]}>
              {suggestedText ? (
                <Text variant="caption" weight="semibold">
                  Suggested: {suggestedText}
                </Text>
              ) : null}
              <Chip label={res.action} small tone={actionTone} />
            </View>
          ) : null}
          {res ? (
            <Text variant="caption" tone="muted">
              {res.reason}
            </Text>
          ) : null}
        </View>
      ) : null}

      {skipped ? (
        <View style={{ marginTop: spacing.md }}>
          <Chip label="Skipped" small tone="warning" />
          <Button title="Undo skip" variant="ghost" size="sm" onPress={p.onUnskip} />
        </View>
      ) : (
        <View style={{ marginTop: spacing.sm }}>
          {exercise.sets.map((s, i) => (
            <SetRow
              key={s.id}
              set={s}
              kind={kind}
              unit={p.unit}
              weightStep={weightStep}
              divider={i < exercise.sets.length - 1}
              onChange={(patch) => p.onSetChange(s.id, patch)}
              onToggle={() => p.onToggleSet(s.id)}
              onLongPress={() =>
                Alert.alert('Remove set?', `Remove set ${s.setNumber} of ${exercise.exercise.name}.`, [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Remove', style: 'destructive', onPress: () => p.onRemoveSet(s.id) },
                ])
              }
            />
          ))}
          <View style={[styles.row, { marginTop: spacing.sm, gap: spacing.sm }]}>
            <Button
              title="Add set"
              variant="secondary"
              size="sm"
              icon={<Plus size={16} color={colors.text} />}
              onPress={() => p.onAddSet('working')}
              testID={`exercise-${exercise.id}-add-set`}
            />
            {kind === 'weighted' ? (
              <Button title="Warm-up set" variant="ghost" size="sm" onPress={() => p.onAddSet('warmup')} />
            ) : null}
            <View style={styles.flex} />
            <Text variant="caption" tone="muted">
              {done}/{exercise.sets.length} done
            </Text>
          </View>
        </View>
      )}
      {exercise.notes ? (
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
          Note: {exercise.notes}
        </Text>
      ) : null}

      <Sheet visible={menu} onClose={() => setMenu(false)} title={exercise.exercise.name}>
        <Button
          title="Substitute exercise"
          variant="secondary"
          fullWidth
          onPress={() => {
            setMenu(false);
            p.onSubstitute();
          }}
          style={{ marginBottom: spacing.sm }}
        />
        <Button
          title={skipped ? 'Undo skip' : 'Skip exercise'}
          variant="secondary"
          fullWidth
          onPress={() => {
            setMenu(false);
            if (skipped) p.onUnskip();
            else p.onSkip();
          }}
          style={{ marginBottom: spacing.sm }}
        />
        <Button
          title="Add note"
          variant="secondary"
          fullWidth
          onPress={() => {
            setMenu(false);
            setNotesOpen(true);
          }}
          style={{ marginBottom: spacing.sm }}
        />
        {exercise.exercise.instructions ? (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            {exercise.exercise.instructions}
          </Text>
        ) : null}
      </Sheet>
      <Sheet visible={notesOpen} onClose={() => setNotesOpen(false)} title="Exercise note">
        <TextField
          value={exercise.notes ?? ''}
          onChangeText={p.onNotes}
          placeholder="e.g. felt heavy, used wider grip"
          multiline
          autoFocus
        />
        <Button title="Done" onPress={() => setNotesOpen(false)} style={{ marginTop: spacing.md }} />
      </Sheet>
    </Card>
  );
}

export const ExerciseCard = memo(ExerciseCardInner);

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'flex-start' },
  flex: { flex: 1 },
  info: {},
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});

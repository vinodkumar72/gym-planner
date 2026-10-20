import React, { memo } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { Stepper, Text } from '@/components/common';
import type { ActiveSet } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';
import { touchTarget } from '@/theme/tokens';
import type { ExerciseKind, WeightUnit } from '@/domain/models/types';

export interface SetRowProps {
  set: ActiveSet;
  kind: ExerciseKind;
  unit: WeightUnit;
  weightStep: number;
  onChange: (patch: Partial<ActiveSet>) => void;
  onToggle: () => void;
  onLongPress?: () => void;
  /** draws a hairline separator under the row (omit on the last set) */
  divider?: boolean;
}

function SetRowInner({ set, kind, unit, weightStep, onChange, onToggle, onLongPress, divider }: SetRowProps) {
  const { colors, radius, spacing } = useTheme();
  const done = set.completed === 1;
  const warmup = set.setType === 'warmup';
  return (
    <Pressable onLongPress={onLongPress} delayLongPress={400} accessibilityLabel={`Set ${set.setNumber}`}>
      <View
        style={[
          styles.row,
          {
            paddingVertical: spacing.md,
            backgroundColor: done ? colors.successMuted : 'transparent',
            borderRadius: radius.md,
            paddingHorizontal: 6,
            borderBottomWidth: divider ? StyleSheet.hairlineWidth : 0,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <View
          style={[
            styles.num,
            {
              backgroundColor: done ? colors.success : warmup ? 'transparent' : colors.surfaceElevated,
              borderColor: done ? colors.success : colors.border,
            },
          ]}
          accessibilityLabel={warmup ? 'Warm-up set' : `Set ${set.setNumber}`}
        >
          <Text
            variant="caption"
            weight="bold"
            style={{ color: done ? colors.textOnPrimary : warmup ? colors.textMuted : colors.text }}
          >
            {warmup ? 'W' : set.setNumber}
          </Text>
        </View>
        <View style={styles.fields}>
          {kind === 'weighted' || kind === 'bodyweight' ? (
            <>
              {kind === 'weighted' || set.weight !== null ? (
                <Stepper
                  label={`weight ${unit}`}
                  caption={`Weight (${unit})`}
                  value={set.weight}
                  step={weightStep}
                  decimals={2}
                  compact
                  onChange={(v) => onChange({ weight: v, weightUnit: v === null ? null : unit })}
                  testID={`set-${set.id}-weight`}
                />
              ) : (
                <View style={styles.spacer}>
                  <Text variant="label" tone="muted" style={styles.spacerCaption}>
                    Weight
                  </Text>
                  <Text variant="caption" tone="muted">
                    bodyweight
                  </Text>
                </View>
              )}
              <Stepper
                label="reps"
                caption="Reps"
                value={set.actualReps}
                step={1}
                compact
                onChange={(v) => onChange({ actualReps: v })}
                testID={`set-${set.id}-reps`}
              />
            </>
          ) : kind === 'timed' ? (
            <Stepper
              label="seconds"
              caption="Seconds"
              value={set.durationSeconds}
              step={5}
              compact
              onChange={(v) => onChange({ durationSeconds: v })}
              testID={`set-${set.id}-duration`}
            />
          ) : (
            <>
              <Stepper
                label="minutes"
                caption="Minutes"
                value={set.durationSeconds === null ? null : Math.round(set.durationSeconds / 60)}
                step={1}
                compact
                onChange={(v) => onChange({ durationSeconds: v === null ? null : v * 60 })}
              />
              <Stepper
                label="distance"
                caption={`Distance (${set.distanceUnit ?? (unit === 'kg' ? 'km' : 'mi')})`}
                value={set.distance}
                step={0.1}
                decimals={2}
                compact
                onChange={(v) => onChange({ distance: v })}
              />
            </>
          )}
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: done }}
          accessibilityLabel={done ? `Set ${set.setNumber} done` : `Mark set ${set.setNumber} done`}
          hitSlop={6}
          testID={`set-${set.id}-done`}
          style={({ pressed }) => [
            styles.check,
            {
              width: touchTarget,
              height: touchTarget,
              borderRadius: radius.md,
              backgroundColor: done ? colors.success : colors.surfaceElevated,
              borderColor: done ? colors.success : colors.border,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Check size={24} color={done ? colors.textOnPrimary : colors.textMuted} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export const SetRow = memo(SetRowInner);

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  num: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    marginRight: 2,
  },
  fields: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'flex-end' },
  spacer: { minWidth: 100, alignItems: 'center', gap: 2 },
  spacerCaption: { fontSize: 10, lineHeight: 12 },
  check: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});

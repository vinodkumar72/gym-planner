import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { roundTo } from '@/utils/units';
import { Text } from './Text';

export interface StepperProps {
  value: number | null;
  onChange: (v: number | null) => void;
  step?: number;
  min?: number;
  max?: number;
  decimals?: number;
  label: string;
  compact?: boolean;
  /** small label rendered above the control, e.g. "Weight (lb)" */
  caption?: string;
  testID?: string;
}

function toText(v: number | null): string {
  return v === null ? '' : String(v);
}

/** Large-tap-target numeric control: − / editable field / +. Empty field means null. */
export function Stepper({
  value,
  onChange,
  step = 1,
  min = 0,
  max = 9999,
  decimals = 0,
  label,
  compact,
  caption,
  testID,
}: StepperProps) {
  const { colors, radius } = useTheme();
  const [text, setText] = useState(toText(value));
  const [syncedValue, setSyncedValue] = useState(value);
  // Derive the field text from the prop when it changes externally (React's recommended pattern).
  if (syncedValue !== value) {
    setSyncedValue(value);
    setText(toText(value));
  }

  const clamp = (n: number) => Math.min(max, Math.max(min, roundTo(n, decimals)));
  const commit = (t: string) => {
    const trimmed = t.trim();
    if (trimmed === '') {
      onChange(null);
      return;
    }
    const n = Number(trimmed.replace(',', '.'));
    if (Number.isFinite(n)) onChange(clamp(n));
    else setText(toText(value));
  };
  const size = compact ? 40 : 48;
  const btn = (icon: React.ReactNode, onPress: () => void, a11y: string) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      hitSlop={6}
      style={({ pressed }) => [
        styles.btn,
        {
          width: size,
          height: size,
          borderRadius: radius.md,
          backgroundColor: pressed ? colors.primaryMuted : colors.surfaceElevated,
          borderColor: colors.border,
        },
      ]}
    >
      {icon}
    </Pressable>
  );
  const control = (
    <View style={styles.row} testID={testID}>
      {btn(
        <Minus size={20} color={colors.text} />,
        () => onChange(clamp((value ?? 0) - step)),
        `Decrease ${label}`,
      )}
      <TextInput
        value={text}
        onChangeText={setText}
        onBlur={() => commit(text)}
        onSubmitEditing={() => commit(text)}
        keyboardType={decimals > 0 ? 'decimal-pad' : 'number-pad'}
        selectTextOnFocus
        accessibilityLabel={label}
        placeholder="—"
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          {
            height: size,
            minWidth: compact ? 56 : 68,
            color: colors.text,
            borderColor: colors.border,
            borderRadius: radius.md,
            backgroundColor: colors.surface,
          },
        ]}
      />
      {btn(
        <Plus size={20} color={colors.text} />,
        () => onChange(clamp((value ?? 0) + step)),
        `Increase ${label}`,
      )}
    </View>
  );
  if (!caption) return control;
  return (
    <View style={styles.captioned}>
      <Text variant="label" tone="muted" style={styles.caption}>
        {caption}
      </Text>
      {control}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  captioned: { alignItems: 'center', gap: 2 },
  caption: { fontSize: 10, lineHeight: 12 },
  btn: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  input: {
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 6,
  },
});

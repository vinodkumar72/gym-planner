import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'primary';
  small?: boolean;
  testID?: string;
}

export function Chip({ label, selected, onPress, tone = 'default', small, testID }: ChipProps) {
  const { colors, radius } = useTheme();
  const toneBg = {
    default: colors.surfaceElevated,
    success: colors.successMuted,
    warning: colors.warningMuted,
    danger: colors.dangerMuted,
    primary: colors.primaryMuted,
  }[tone];
  const toneFg = {
    default: colors.text,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    primary: colors.primary,
  }[tone];
  const inner = (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : toneBg,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: radius.full,
          paddingVertical: small ? 4 : 8,
          paddingHorizontal: small ? 10 : 14,
          minHeight: small ? 26 : 40,
        },
      ]}
    >
      <Text variant={small ? 'caption' : 'body'} weight="medium" style={{ color: selected ? colors.textOnPrimary : toneFg }}>
        {label}
      </Text>
    </View>
  );
  if (!onPress) return <View testID={testID}>{inner}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }} accessibilityLabel={label} testID={testID}>
      {inner}
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  chip: { borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});

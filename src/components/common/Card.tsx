import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

export interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  padded?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

export function Card({ children, style, onPress, tone = 'default', padded = true, accessibilityLabel, testID }: CardProps) {
  const { colors, radius, spacing } = useTheme();
  const bg =
    tone === 'primary'
      ? colors.primaryMuted
      : tone === 'success'
        ? colors.successMuted
        : tone === 'warning'
          ? colors.warningMuted
          : tone === 'danger'
            ? colors.dangerMuted
            : colors.surface;
  const base = [
    styles.card,
    { backgroundColor: bg, borderRadius: radius.lg, borderColor: colors.border, padding: padded ? spacing.lg : 0 },
    style,
  ];
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        style={({ pressed }) => [base, pressed && styles.pressed]}
      >
        {children}
      </Pressable>
    );
  }
  return (
    <View style={base} testID={testID}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.85 },
});

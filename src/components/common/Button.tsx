import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { touchTarget } from '@/theme/tokens';
import { Text } from './Text';

export interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
  fullWidth?: boolean;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled,
  loading,
  icon,
  style,
  accessibilityLabel,
  testID,
  fullWidth,
}: ButtonProps) {
  const { colors, radius, spacing } = useTheme();
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : variant === 'success'
          ? colors.success
          : variant === 'secondary'
            ? colors.surfaceElevated
            : 'transparent';
  const fg = variant === 'primary' || variant === 'danger' || variant === 'success' ? colors.textOnPrimary : variant === 'ghost' ? colors.primary : colors.text;
  const height = size === 'lg' ? 56 : size === 'sm' ? 40 : touchTarget;
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!isDisabled }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderRadius: radius.md,
          height,
          paddingHorizontal: spacing.lg,
          opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1,
          borderWidth: variant === 'secondary' ? StyleSheet.hairlineWidth : 0,
          borderColor: colors.border,
        },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.row}>
          {icon ? <View style={{ marginRight: spacing.sm }}>{icon}</View> : null}
          <Text variant={size === 'lg' ? 'subheading' : 'body'} weight="semibold" style={{ color: fg }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start' },
  fullWidth: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', alignItems: 'center' },
});

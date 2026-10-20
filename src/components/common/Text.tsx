import React from 'react';
import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';

type Variant = 'display' | 'title' | 'heading' | 'subheading' | 'body' | 'caption' | 'label';
type Tone = 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'danger' | 'onPrimary';

export interface TextProps extends RNTextProps {
  variant?: Variant;
  tone?: Tone;
  weight?: 'regular' | 'medium' | 'semibold' | 'bold';
  center?: boolean;
}

export function Text({ variant = 'body', tone = 'default', weight, center, style, ...rest }: TextProps) {
  const { colors, fontSize } = useTheme();
  const toneColor: Record<Tone, string> = {
    default: colors.text,
    muted: colors.textMuted,
    primary: colors.primary,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
    onPrimary: colors.textOnPrimary,
  };
  const variants: Record<Variant, { fontSize: number; fontWeight: TextProps['weight']; lineHeight: number }> = {
    display: { fontSize: fontSize.display, fontWeight: 'bold', lineHeight: 40 },
    title: { fontSize: fontSize.xxl, fontWeight: 'bold', lineHeight: 34 },
    heading: { fontSize: fontSize.xl, fontWeight: 'semibold', lineHeight: 28 },
    subheading: { fontSize: fontSize.lg, fontWeight: 'semibold', lineHeight: 24 },
    body: { fontSize: fontSize.md, fontWeight: 'regular', lineHeight: 22 },
    caption: { fontSize: fontSize.sm, fontWeight: 'regular', lineHeight: 18 },
    label: { fontSize: fontSize.xs, fontWeight: 'semibold', lineHeight: 16 },
  };
  const v = variants[variant];
  const fw = weight ?? v.fontWeight ?? 'regular';
  const fontWeight = fw === 'bold' ? '700' : fw === 'semibold' ? '600' : fw === 'medium' ? '500' : '400';
  return (
    <RNText
      {...rest}
      style={[
        { color: toneColor[tone], fontSize: v.fontSize, lineHeight: v.lineHeight, fontWeight },
        variant === 'label' && styles.label,
        center && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  label: { textTransform: 'uppercase', letterSpacing: 0.8 },
  center: { textAlign: 'center' },
});

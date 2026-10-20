import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text variant="label" tone="muted" style={{ marginBottom: spacing.xs }}>
        {label}
      </Text>
      {children}
      {hint ? (
        <Text variant="caption" tone="muted" style={{ marginTop: spacing.xs }}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export function TextField(props: TextInputProps & { label?: string; hint?: string }) {
  const { colors, radius, spacing } = useTheme();
  const input = (
    <TextInput
      placeholderTextColor={colors.textMuted}
      {...props}
      style={[
        styles.input,
        { color: colors.text, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.surface, paddingHorizontal: spacing.md },
        props.multiline && styles.multiline,
        props.style,
      ]}
    />
  );
  if (!props.label) return input;
  return (
    <Field label={props.label} hint={props.hint}>
      {input}
    </Field>
  );
}

const styles = StyleSheet.create({
  input: { minHeight: 48, fontSize: 16, borderWidth: StyleSheet.hairlineWidth },
  multiline: { minHeight: 88, textAlignVertical: 'top', paddingTop: 12 },
});

import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { touchTarget } from '@/theme/tokens';
import { Text } from './Text';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  left?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  testID?: string;
  accessibilityLabel?: string;
  last?: boolean;
}

export function ListRow({ title, subtitle, left, right, onPress, chevron, testID, accessibilityLabel, last }: ListRowProps) {
  const { colors, spacing } = useTheme();
  const body = (
    <View style={[styles.row, { minHeight: touchTarget + 8, paddingVertical: spacing.sm, borderBottomColor: colors.border, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth }]}>
      {left ? <View style={{ marginRight: spacing.md }}>{left}</View> : null}
      <View style={styles.text}>
        <Text weight="medium">{title}</Text>
        {subtitle ? (
          <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {chevron ? <ChevronRight size={20} color={colors.textMuted} /> : null}
    </View>
  );
  if (!onPress) return <View testID={testID}>{body}</View>;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? title} testID={testID} style={({ pressed }) => pressed && styles.pressed}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  text: { flex: 1 },
  pressed: { opacity: 0.7 },
});

import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export function Section({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  const { spacing } = useTheme();
  return (
    <View style={{ marginTop: spacing.xl }}>
      <View style={[styles.head, { marginBottom: spacing.sm }]}>
        <Text variant="label" tone="muted">
          {title}
        </Text>
        {right}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({ head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' } });

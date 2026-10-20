import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, message, actionTitle, onAction }: EmptyStateProps) {
  const { spacing } = useTheme();
  return (
    <View style={[styles.wrap, { padding: spacing.xl, gap: spacing.md }]}>
      {icon}
      <Text variant="subheading" center>
        {title}
      </Text>
      {message ? (
        <Text tone="muted" center>
          {message}
        </Text>
      ) : null}
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} style={{ marginTop: spacing.sm }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' } });

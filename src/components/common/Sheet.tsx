import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { X } from 'lucide-react-native';
import { useTheme } from '@/theme/ThemeProvider';
import { Text } from './Text';

export interface SheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
}

/** Bottom sheet built on the core Modal so it needs no extra native dependency. */
export function Sheet({ visible, onClose, title, children, testID }: SheetProps) {
  const { colors, radius, spacing } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} testID={testID}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg }]}>
        <View style={[styles.header, { marginBottom: spacing.md }]}>
          <Text variant="heading" style={styles.title}>
            {title ?? ''}
          </Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
            <X size={24} color={colors.textMuted} />
          </Pressable>
        </View>
        {children}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { paddingBottom: 32, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flex: 1 },
});

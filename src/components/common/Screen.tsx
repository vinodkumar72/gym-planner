import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useScreenInsets } from '@/hooks/useScreenInsets';
import { useTheme } from '@/theme/ThemeProvider';
import { touchTarget } from '@/theme/tokens';
import { Text } from './Text';

/** Content column cap shared by all screens (tablet readability). */
export const MAX_CONTENT_WIDTH = 760;

export interface ScreenProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  scroll?: boolean;
  padded?: boolean;
  right?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  testID?: string;
  /** Force the back button on/off. By default it shows on any screen outside the tab bar that can go back. */
  back?: boolean;
  /** sticky content rendered below the scroll area, above the home indicator (e.g. wizard buttons) */
  footer?: React.ReactNode;
}

export function Screen({
  children,
  title,
  subtitle,
  scroll = true,
  padded = true,
  right,
  style,
  edges,
  testID,
  back,
  footer,
}: ScreenProps) {
  const { colors, spacing, radius } = useTheme();
  const insets = useScreenInsets();
  const router = useRouter();
  const segments = useSegments();
  const use = edges ?? ['top', 'left', 'right'];
  const inTabs = segments[0] === '(tabs)';
  const showBack = back ?? (!inTabs && router.canGoBack());
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/today');
  };

  const header =
    title || showBack ? (
      <View
        style={[
          styles.header,
          styles.column,
          { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
        ]}
      >
        {showBack ? (
          <Pressable
            onPress={goBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
            testID="screen-back"
            style={({ pressed }) => [
              styles.back,
              {
                width: touchTarget,
                height: touchTarget,
                borderRadius: radius.md,
                marginRight: spacing.sm,
                backgroundColor: pressed ? colors.primaryMuted : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <ChevronLeft size={26} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.headerText}>
          {title ? (
            <Text variant="title" accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {subtitle ? (
            <Text tone="muted" style={{ marginTop: 2 }}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        {right}
      </View>
    ) : null;
  const content = padded ? (
    <View
      style={[
        styles.column,
        { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl + (footer ? 0 : insets.bottom) },
        style,
      ]}
    >
      {children}
    </View>
  ) : (
    <View style={[styles.column, styles.grow]}>{children}</View>
  );
  return (
    <View
      style={[
        styles.safe,
        {
          backgroundColor: colors.background,
          paddingTop: use.includes('top') ? insets.top : 0,
          paddingBottom: use.includes('bottom') ? insets.bottom : 0,
          paddingLeft: use.includes('left') ? insets.left : 0,
          paddingRight: use.includes('right') ? insets.right : 0,
        },
      ]}
      testID={testID}
    >
      {header}
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top}
      >
        {scroll ? (
          <ScrollView
            style={styles.fill}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            contentContainerStyle={styles.grow}
          >
            {content}
          </ScrollView>
        ) : (
          <View style={styles.fill}>{content}</View>
        )}
      </KeyboardAvoidingView>
      {footer ? (
        <View
          style={[
            styles.column,
            styles.footer,
            {
              paddingHorizontal: spacing.lg,
              paddingTop: spacing.md,
              paddingBottom: spacing.md + insets.bottom,
              borderTopColor: colors.border,
              backgroundColor: colors.background,
            },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  /** bounded to the available space so a sticky footer is never pushed off-screen */
  fill: { flex: 1, minHeight: 0 },
  grow: { flexGrow: 1 },
  /** keeps reading width comfortable on tablets; no effect on phones */
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerText: { flex: 1 },
  footer: { borderTopWidth: StyleSheet.hairlineWidth },
  back: { alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
});

import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Timer } from 'lucide-react-native';
import { Text } from '@/components/common';
import { MAX_CONTENT_WIDTH } from '@/components/common/Screen';
import type { RestTimer } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';
import { formatClock } from '@/utils/units';

export function RestTimerBar({
  timer,
  onSkip,
  onExtend,
}: {
  timer: RestTimer;
  onSkip: () => void;
  onExtend: (s: number) => void;
}) {
  const { colors, spacing, radius } = useTheme();
  const [now, setNow] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = now === 0 ? timer.durationSeconds : Math.max(0, Math.ceil((timer.endsAt - now) / 1000));
  const progress = timer.durationSeconds > 0 ? Math.min(1, remaining / timer.durationSeconds) : 0;
  const finished = remaining === 0;
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: finished ? colors.success : colors.surfaceElevated,
          borderColor: colors.border,
          borderRadius: radius.lg,
          padding: spacing.md,
        },
      ]}
      accessibilityLiveRegion="polite"
      testID="rest-timer"
    >
      <View
        style={[
          styles.progress,
          { backgroundColor: colors.primary, width: `${progress * 100}%`, borderRadius: radius.lg },
        ]}
      />
      <View style={styles.row}>
        <Timer size={20} color={finished ? colors.textOnPrimary : colors.primary} />
        <Text
          variant="heading"
          style={{
            color: finished ? colors.textOnPrimary : colors.text,
            marginLeft: spacing.sm,
            minWidth: 64,
          }}
        >
          {finished ? 'Go!' : formatClock(remaining)}
        </Text>
        <View style={styles.flex} />
        {!finished ? (
          <Pressable
            onPress={() => onExtend(30)}
            accessibilityRole="button"
            accessibilityLabel="Add 30 seconds"
            hitSlop={8}
            style={{ marginRight: spacing.lg }}
          >
            <Text weight="semibold" tone="primary">
              +30s
            </Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={finished ? 'Dismiss timer' : 'Skip rest'}
          hitSlop={8}
        >
          <Text weight="semibold" style={{ color: finished ? colors.textOnPrimary : colors.textMuted }}>
            {finished ? 'Dismiss' : 'Skip'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
  },
  progress: { position: 'absolute', left: 0, top: 0, bottom: 0, opacity: 0.15 },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
});

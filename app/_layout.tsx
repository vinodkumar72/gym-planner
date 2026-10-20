import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import migrations from '../drizzle/migrations';
import { getDb, getExpoDb } from '@/db/client';
import { seedDatabase } from '@/db/seed';
import { useAppStore, useThemePreference } from '@/stores/appStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { Text } from '@/components/common/Text';
import { Button } from '@/components/common/Button';

function Boot({ children }: { children: React.ReactNode }) {
  const { success, error } = useMigrations(getExpoDb(), migrations);
  const [seeded, setSeeded] = useState(false);
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const load = useAppStore((s) => s.load);
  const hydrate = useWorkoutStore((s) => s.hydrate);
  const { colors } = useTheme();

  useEffect(() => {
    if (!success) return;
    let cancelled = false;
    (async () => {
      try {
        await seedDatabase(getDb());
        await load();
        await hydrate();
        if (!cancelled) setSeeded(true);
      } catch (e) {
        if (!cancelled) setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [success, load, hydrate, attempt]);

  if (error || bootError) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text variant="heading" center>
          Couldn&apos;t open your data
        </Text>
        <Text tone="muted" center style={styles.gap}>
          {error?.message ?? bootError}
        </Text>
        <Button title="Try again" onPress={() => setAttempt((a) => a + 1)} style={styles.gap} />
      </View>
    );
  }
  if (!success || !seeded) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  return <>{children}</>;
}

function Themed({ children }: { children: React.ReactNode }) {
  const preference = useThemePreference();
  return <ThemeProvider preference={preference}>{children}</ThemeProvider>;
}

function StatusBarStyle() {
  const { dark } = useTheme();
  return <StatusBar style={dark ? 'light' : 'dark'} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Themed>
        <StatusBarStyle />
        <Boot>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="onboarding/index" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout/[sessionId]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
            <Stack.Screen name="workout/summary/[sessionId]" options={{ presentation: 'modal' }} />
          </Stack>
        </Boot>
      </Themed>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  gap: { marginTop: 12 },
});

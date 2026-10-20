import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Bell, Database, Dumbbell, ShieldCheck, Sparkles, Trash } from 'lucide-react-native';
import {
  Card,
  Chip,
  ChipRow,
  Field,
  ListRow,
  Screen,
  Section,
  Sheet,
  Stepper,
  Text,
  Button,
  TextField,
} from '@/components/common';
import { DAY_SHORT, type ThemePreference, type WeightUnit } from '@/domain/models/types';
import { useAppStore } from '@/stores/appStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';
import { destroyDatabase, getDb } from '@/db/client';
import { countCompletedSessions } from '@/db/repositories/sessionRepo';
import { useAsyncData } from '@/hooks/useAsyncData';
import { loadDemoData } from '@/services/demoDataService';
import { newId } from '@/utils/ids';
import { cancelReminders } from '@/services/notificationService';

export default function SettingsScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const prefs = useAppStore((s) => s.preferences);
  const bump = useAppStore((s) => s.bump);
  const countSessions = useCallback(() => countCompletedSessions(getDb()), []);
  const { data: completedCount } = useAsyncData(countSessions, []);
  const [loadingDemo, setLoadingDemo] = useState(false);
  const setPreferences = useAppStore((s) => s.setPreferences);
  const clearWorkout = useWorkoutStore((s) => s.clear);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  if (!prefs) return null;

  const loadSample = () => {
    Alert.alert(
      'Load sample data?',
      'Adds eight weeks of example workouts for the active routine so you can explore the app. Only available while your history is empty; delete all data to remove it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          onPress: async () => {
            setLoadingDemo(true);
            try {
              const { sessions } = await loadDemoData(getDb(), { idFactory: newId });
              bump();
              Alert.alert('Sample data loaded', sessions + ' example workouts were added.');
            } catch (e) {
              Alert.alert('Could not load sample data', e instanceof Error ? e.message : String(e));
            } finally {
              setLoadingDemo(false);
            }
          },
        },
      ],
    );
  };
  let days: number[] = [];
  try {
    days = JSON.parse(prefs.preferredTrainingDays) as number[];
  } catch {
    days = [];
  }
  const toggleDay = (d: number) => {
    const next = days.includes(d) ? days.filter((x) => x !== d) : [...days, d].sort();
    void setPreferences({
      preferredTrainingDays: JSON.stringify(next),
      trainingDaysPerWeek: Math.max(1, next.length),
    });
  };

  const deleteAll = async () => {
    try {
      await cancelReminders();
      clearWorkout();
      destroyDatabase();
    } catch (e) {
      Alert.alert('Could not delete', e instanceof Error ? e.message : String(e));
      return;
    }
    setConfirmOpen(false);
    Alert.alert('All data deleted', 'Close and reopen the app to start fresh.');
  };

  return (
    <Screen title="Settings" testID="settings-screen">
      <Section title="Units">
        <Field label="Weight">
          <ChipRow>
            <Chip
              label="lb"
              selected={prefs.weightUnit === 'lb'}
              onPress={() => setPreferences({ weightUnit: 'lb' as WeightUnit })}
              testID="unit-lb"
            />
            <Chip
              label="kg"
              selected={prefs.weightUnit === 'kg'}
              onPress={() => setPreferences({ weightUnit: 'kg' as WeightUnit })}
              testID="unit-kg"
            />
          </ChipRow>
        </Field>
        <Field label="Distance">
          <ChipRow>
            <Chip
              label="mi"
              selected={prefs.distanceUnit === 'mi'}
              onPress={() => setPreferences({ distanceUnit: 'mi' })}
            />
            <Chip
              label="km"
              selected={prefs.distanceUnit === 'km'}
              onPress={() => setPreferences({ distanceUnit: 'km' })}
            />
          </ChipRow>
        </Field>
      </Section>

      <Section title="Workout">
        <Field label="Training days" hint="Used for weekly targets, streaks and reminders.">
          <ChipRow>
            {DAY_SHORT.map((d, i) => (
              <Chip key={d} label={d} small selected={days.includes(i)} onPress={() => toggleDay(i)} />
            ))}
          </ChipRow>
        </Field>
        <Field label="Default rest (seconds)" hint="Applied to new exercises you add to routines.">
          <Stepper
            label="default rest"
            value={prefs.defaultRestSeconds}
            step={15}
            min={0}
            max={600}
            onChange={(v) => setPreferences({ defaultRestSeconds: v ?? 90 })}
          />
        </Field>
        <Field label="Appearance">
          <ChipRow>
            {(['system', 'light', 'dark'] as ThemePreference[]).map((t) => (
              <Chip
                key={t}
                label={t[0]?.toUpperCase() + t.slice(1)}
                selected={prefs.theme === t}
                onPress={() => setPreferences({ theme: t })}
              />
            ))}
          </ChipRow>
        </Field>
      </Section>

      <Section title="Reminders">
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            left={<Bell size={20} color={colors.textMuted} />}
            title="Notifications"
            subtitle={prefs.notificationsEnabled ? `Workout reminders at ${prefs.reminderTime}` : 'Off'}
            onPress={() => router.push('/settings/notifications')}
            chevron
            last
          />
        </Card>
      </Section>

      <Section title="Data">
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            left={<Database size={20} color={colors.textMuted} />}
            title="Backup & restore"
            subtitle="Export, import, CSV"
            onPress={() => router.push('/settings/backup')}
            chevron
          />
          <ListRow
            left={<Dumbbell size={20} color={colors.textMuted} />}
            title="Exercise library"
            subtitle="Browse and create exercises"
            onPress={() => router.push('/exercises')}
            chevron
          />
          <ListRow
            left={<ShieldCheck size={20} color={colors.textMuted} />}
            title="Privacy"
            subtitle="Everything stays on this device"
            onPress={() => router.push('/settings/privacy')}
            chevron
            last={completedCount !== 0}
          />
          {completedCount === 0 ? (
            <ListRow
              left={<Sparkles size={20} color={colors.textMuted} />}
              title={loadingDemo ? 'Loading sample data…' : 'Load sample data'}
              subtitle="Eight weeks of example workouts to explore the app"
              onPress={loadingDemo ? undefined : loadSample}
              chevron
              last
              testID="load-sample-data"
            />
          ) : null}
        </Card>
      </Section>

      <Section title="Danger zone">
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          <ListRow
            left={<Trash size={20} color={colors.danger} />}
            title="Delete all local data"
            subtitle="Removes every workout, routine and setting"
            onPress={() => setConfirmOpen(true)}
            chevron
            last
          />
        </Card>
      </Section>

      <Sheet visible={confirmOpen} onClose={() => setConfirmOpen(false)} title="Delete everything?">
        <Text tone="muted" style={{ marginBottom: spacing.md }}>
          This cannot be undone. Export a backup first if you might want this data later. Type DELETE to
          confirm.
        </Text>
        <TextField
          value={confirmText}
          onChangeText={setConfirmText}
          autoCapitalize="characters"
          placeholder="DELETE"
        />
        <Button
          title="Delete all data"
          variant="danger"
          disabled={confirmText !== 'DELETE'}
          onPress={deleteAll}
          style={{ marginTop: spacing.md }}
          fullWidth
        />
      </Sheet>
    </Screen>
  );
}

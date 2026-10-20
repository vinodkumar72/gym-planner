import React, { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Button, Card, Field, ListRow, Screen, Text, TextField } from '@/components/common';
import { requestPermission, syncReminders } from '@/services/notificationService';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function NotificationsScreen() {
  const { colors, spacing } = useTheme();
  const prefs = useAppStore((s) => s.preferences);
  const setPreferences = useAppStore((s) => s.setPreferences);
  const [time, setTime] = useState(prefs?.reminderTime ?? '17:00');
  if (!prefs) return null;

  const toggle = async (on: boolean) => {
    if (on) {
      const granted = await requestPermission();
      if (!granted) {
        Alert.alert('Permission needed', 'Enable notifications for Gym Planner in your system settings to receive reminders.');
        return;
      }
    }
    await setPreferences({ notificationsEnabled: on ? 1 : 0 });
    await syncReminders();
  };
  const saveTime = async () => {
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
      Alert.alert('Invalid time', 'Use HH:MM, e.g. 17:30');
      return;
    }
    await setPreferences({ reminderTime: time });
    await syncReminders();
  };
  const toggleRest = async (on: boolean) => {
    await setPreferences({ restDayReminder: on ? 1 : 0 });
    await syncReminders();
  };

  return (
    <Screen title="Reminders">
      <Text tone="muted">All reminders are local notifications scheduled on this device. Nothing is sent over the internet.</Text>
      <Card style={{ marginTop: spacing.lg }}>
        <ListRow title="Workout reminders" subtitle="On your training days" right={<Switch value={prefs.notificationsEnabled === 1} onValueChange={toggle} trackColor={{ true: colors.primary }} accessibilityLabel="Workout reminders" />} />
        <ListRow title="Rest-day reminder" subtitle="A gentle nudge on off days" right={<Switch value={prefs.restDayReminder === 1} onValueChange={toggleRest} disabled={prefs.notificationsEnabled !== 1} trackColor={{ true: colors.primary }} accessibilityLabel="Rest day reminder" />} last />
      </Card>
      <View style={{ marginTop: spacing.lg }}>
        <Field label="Reminder time (24h)" hint="Also used for the rest timer alert when the app is in the background.">
          <TextField value={time} onChangeText={setTime} keyboardType="numbers-and-punctuation" placeholder="17:00" />
        </Field>
        <Button title="Save time" variant="secondary" onPress={saveTime} />
      </View>
    </Screen>
  );
}

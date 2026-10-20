import React from 'react';
import { Card, Screen, Section, Text } from '@/components/common';
import { useTheme } from '@/theme/ThemeProvider';

export default function PrivacyScreen() {
  const { spacing } = useTheme();
  return (
    <Screen title="Privacy">
      <Card>
        <Text variant="subheading">Your data never leaves your phone</Text>
        <Text tone="muted" style={{ marginTop: spacing.sm }}>
          Gym Planner stores every routine, workout and setting in a local SQLite database inside the app&apos;s private storage. There is no account, no server, no analytics and no crash reporting.
        </Text>
      </Card>
      <Section title="What the app does not do">
        <Card>
          <Text>• No internet access is required or used for any feature.</Text>
          <Text>• No advertising, tracking or analytics SDKs are included.</Text>
          <Text>• No data is synced to any cloud service.</Text>
          <Text>• No personal information is collected.</Text>
        </Card>
      </Section>
      <Section title="Backups">
        <Card>
          <Text tone="muted">
            Backups are files you create on purpose. You choose where they go through the system share sheet. An optional passphrase encrypts the file with AES-256-GCM; without one, the file is plain JSON that anyone with the file can read.
          </Text>
        </Card>
      </Section>
      <Section title="Notifications">
        <Card>
          <Text tone="muted">Reminders are scheduled locally on the device and only after you turn them on. Permission is requested at that moment, never at launch.</Text>
        </Card>
      </Section>
      <Section title="Not medical advice">
        <Card>
          <Text tone="muted">Progression and readiness suggestions are simple rules based on what you logged. They do not diagnose injury or recovery. Stop if something hurts and consult a professional.</Text>
        </Card>
      </Section>
    </Screen>
  );
}

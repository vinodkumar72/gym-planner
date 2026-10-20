import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Chip, ChipRow, Field, Screen, Text, TextField } from '@/components/common';
import { getDb } from '@/db/client';
import type { RotationType } from '@/domain/models/types';
import { createRoutine } from '@/services/routineService';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';
import { newId } from '@/utils/ids';

export default function NewRoutineScreen() {
  const router = useRouter();
  const { spacing } = useTheme();
  const bump = useAppStore((s) => s.bump);
  const [name, setName] = useState('');
  const [rotationType, setRotationType] = useState<RotationType>('rotation');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const id = await createRoutine(getDb(), { name, rotationType, idFactory: newId });
      bump();
      router.replace(`/routines/${id}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="New routine">
      <TextField label="Name" placeholder="e.g. Summer strength" value={name} onChangeText={setName} autoFocus testID="routine-name" />
      <Field label="Scheduling" hint={rotationType === 'rotation' ? 'Workouts follow each other in order whenever you train. Missed days never skip a workout.' : 'Assign workouts to weekdays. If you miss one, you choose whether to catch up.'}>
        <ChipRow>
          <Chip label="Rotation" selected={rotationType === 'rotation'} onPress={() => setRotationType('rotation')} />
          <Chip label="Calendar" selected={rotationType === 'calendar'} onPress={() => setRotationType('calendar')} />
        </ChipRow>
      </Field>
      <Text tone="muted" style={{ marginBottom: spacing.lg }}>
        You&apos;ll add workout days and exercises on the next screen.
      </Text>
      <Button title="Create routine" onPress={save} loading={saving} disabled={!name.trim()} fullWidth testID="create-routine" />
      <Button title="Cancel" variant="ghost" onPress={() => router.back()} fullWidth style={{ marginTop: spacing.sm }} />
    </Screen>
  );
}

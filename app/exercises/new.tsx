import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Chip, ChipRow, Field, Screen, TextField } from '@/components/common';
import { getDb } from '@/db/client';
import { insertExercise } from '@/db/repositories/exerciseRepo';
import { EQUIPMENT, MUSCLE_GROUPS, type Equipment, type ExerciseType, type MuscleGroup } from '@/domain/models/types';
import { titleCase } from '@/services/templateInfo';
import { useAppStore } from '@/stores/appStore';
import { newId, nowIso } from '@/utils/ids';

export default function NewExerciseScreen() {
  const router = useRouter();
  const bump = useAppStore((s) => s.bump);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('dumbbell');
  const [type, setType] = useState<ExerciseType>('strength');
  const [bodyweight, setBodyweight] = useState(false);
  const [instructions, setInstructions] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const now = nowIso();
      await insertExercise(getDb(), {
        id: newId(),
        name: name.trim(),
        primaryMuscleGroup: muscle,
        secondaryMuscleGroups: '[]',
        equipment,
        exerciseType: type,
        isBodyweight: bodyweight || equipment === 'bodyweight' ? 1 : 0,
        instructions: instructions.trim() || null,
        isCustom: 1,
        createdAt: now,
        updatedAt: now,
      });
      bump();
      router.back();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen title="New exercise">
      <TextField label="Name" value={name} onChangeText={setName} autoFocus placeholder="e.g. Landmine Press" testID="exercise-name" />
      <Field label="Primary muscle">
        <ChipRow>
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} label={titleCase(g)} small selected={muscle === g} onPress={() => setMuscle(g)} />
          ))}
        </ChipRow>
      </Field>
      <Field label="Equipment">
        <ChipRow>
          {EQUIPMENT.map((e) => (
            <Chip key={e} label={titleCase(e)} small selected={equipment === e} onPress={() => setEquipment(e)} />
          ))}
        </ChipRow>
      </Field>
      <Field label="Type" hint="Strength logs weight and reps; timed logs seconds; cardio logs time and distance.">
        <ChipRow>
          <Chip label="Strength" selected={type === 'strength'} onPress={() => setType('strength')} />
          <Chip label="Timed" selected={type === 'duration'} onPress={() => setType('duration')} />
          <Chip label="Cardio" selected={type === 'cardio'} onPress={() => setType('cardio')} />
        </ChipRow>
      </Field>
      {type === 'strength' ? (
        <Field label="Load">
          <ChipRow>
            <Chip label="Weighted" selected={!bodyweight} onPress={() => setBodyweight(false)} />
            <Chip label="Bodyweight" selected={bodyweight} onPress={() => setBodyweight(true)} />
          </ChipRow>
        </Field>
      ) : null}
      <TextField label="Instructions (optional)" value={instructions} onChangeText={setInstructions} multiline />
      <Button title="Save exercise" onPress={save} loading={saving} disabled={!name.trim()} fullWidth testID="save-exercise" />
    </Screen>
  );
}

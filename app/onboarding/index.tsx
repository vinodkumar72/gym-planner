import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Chip, ChipRow, Screen, Text } from '@/components/common';
import { getDb } from '@/db/client';
import { activateRoutine } from '@/db/repositories/routineRepo';
import { SEED_ROUTINES } from '@/db/seed/routines';
import {
  EQUIPMENT,
  type Equipment,
  type ExperienceLevel,
  type Goal,
  type WeightUnit,
} from '@/domain/models/types';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';
import { nowIso } from '@/utils/ids';

const GOALS: { value: Goal; label: string; hint: string }[] = [
  { value: 'strength', label: 'Get stronger', hint: 'Lower reps, heavier weights' },
  { value: 'muscle', label: 'Build muscle', hint: 'Moderate reps, steady progression' },
  { value: 'general', label: 'General fitness', hint: 'Strength plus some cardio' },
  { value: 'consistency', label: 'Build the habit', hint: 'Short, simple sessions' },
];
const LEVELS: { value: ExperienceLevel; label: string; hint: string }[] = [
  { value: 'beginner', label: 'Beginner', hint: 'New to lifting or returning after a long break' },
  { value: 'intermediate', label: 'Intermediate', hint: 'Comfortable with the main lifts' },
  { value: 'advanced', label: 'Advanced', hint: 'Years of consistent training' },
];
const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbells',
  machine: 'Machines',
  cable: 'Cables',
  kettlebell: 'Kettlebell',
  bodyweight: 'Bodyweight',
  band: 'Bands',
  cardio_machine: 'Cardio machines',
  other: 'Other',
};

const STEPS = ['Goal', 'Experience', 'Schedule', 'Equipment', 'Units', 'Routine'] as const;

export default function Onboarding() {
  const router = useRouter();
  const { spacing } = useTheme();
  const setPreferences = useAppStore((s) => s.setPreferences);
  const bump = useAppStore((s) => s.bump);

  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<Goal>('muscle');
  const [level, setLevel] = useState<ExperienceLevel>('beginner');
  const [days, setDays] = useState(3);
  const [equipment, setEquipment] = useState<Equipment[]>([
    'barbell',
    'dumbbell',
    'machine',
    'cable',
    'bodyweight',
  ]);
  const [unit, setUnit] = useState<WeightUnit>('lb');
  const [routineId, setRoutineId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const recommended = useMemo(() => {
    const scored = SEED_ROUTINES.map((r) => {
      let score = 0;
      if (r.suits.experience.includes(level)) score += 2;
      if (r.suits.daysPerWeek.includes(days)) score += 2;
      if (goal === 'general' && r.id === 'rt_general_fitness') score += 3;
      if (goal === 'consistency' && r.id === 'rt_full_body') score += 2;
      if (goal === 'strength' && r.id === 'rt_upper_lower') score += 1;
      if (goal === 'muscle' && r.id === 'rt_ppl') score += 1;
      return { r, score };
    }).sort((a, b) => b.score - a.score);
    return scored.map((s) => s.r);
  }, [goal, level, days]);
  const chosen = routineId ?? recommended[0]?.id ?? 'rt_full_body';

  const finish = async () => {
    setSaving(true);
    try {
      const now = nowIso();
      await activateRoutine(getDb(), chosen, now);
      await setPreferences({
        goal,
        experienceLevel: level,
        trainingDaysPerWeek: days,
        equipment: JSON.stringify(equipment),
        weightUnit: unit,
        distanceUnit: unit === 'kg' ? 'km' : 'mi',
        onboardingCompleted: 1,
      });
      bump();
      router.replace('/(tabs)/today');
    } finally {
      setSaving(false);
    }
  };

  const toggleEquipment = (e: Equipment) =>
    setEquipment((cur) => (cur.includes(e) ? cur.filter((x) => x !== e) : [...cur, e]));

  const title = STEPS[step] ?? '';
  return (
    <Screen
      title={step === 0 ? 'Welcome' : title}
      subtitle={`Step ${step + 1} of ${STEPS.length}`}
      testID="onboarding"
      back={false}
      footer={
        <View style={[styles.footer, { gap: spacing.sm }]}>
          {step > 0 ? (
            <Button title="Back" variant="secondary" onPress={() => setStep((s) => s - 1)} />
          ) : (
            <View />
          )}
          {step < STEPS.length - 1 ? (
            <Button title="Continue" onPress={() => setStep((s) => s + 1)} testID="onboarding-next" />
          ) : (
            <Button title="Start training" onPress={finish} loading={saving} testID="onboarding-finish" />
          )}
        </View>
      }
    >
      {step === 0 && (
        <>
          <Text tone="muted" style={{ marginBottom: spacing.lg }}>
            No account, no cloud. Everything stays on this phone. What&apos;s your main goal?
          </Text>
          {GOALS.map((g) => (
            <Card
              key={g.value}
              onPress={() => setGoal(g.value)}
              tone={goal === g.value ? 'primary' : 'default'}
              style={{ marginBottom: spacing.sm }}
              testID={`goal-${g.value}`}
            >
              <Text weight="semibold">{g.label}</Text>
              <Text variant="caption" tone="muted">
                {g.hint}
              </Text>
            </Card>
          ))}
        </>
      )}
      {step === 1 &&
        LEVELS.map((l) => (
          <Card
            key={l.value}
            onPress={() => setLevel(l.value)}
            tone={level === l.value ? 'primary' : 'default'}
            style={{ marginBottom: spacing.sm }}
            testID={`level-${l.value}`}
          >
            <Text weight="semibold">{l.label}</Text>
            <Text variant="caption" tone="muted">
              {l.hint}
            </Text>
          </Card>
        ))}
      {step === 2 && (
        <>
          <Text tone="muted" style={{ marginBottom: spacing.lg }}>
            How many days a week can you realistically train?
          </Text>
          <ChipRow>
            {[2, 3, 4, 5, 6].map((d) => (
              <Chip
                key={d}
                label={`${d} days`}
                selected={days === d}
                onPress={() => setDays(d)}
                testID={`days-${d}`}
              />
            ))}
          </ChipRow>
        </>
      )}
      {step === 3 && (
        <>
          <Text tone="muted" style={{ marginBottom: spacing.lg }}>
            What equipment do you have access to? (You can change this later.)
          </Text>
          <ChipRow>
            {EQUIPMENT.map((e) => (
              <Chip
                key={e}
                label={EQUIPMENT_LABELS[e]}
                selected={equipment.includes(e)}
                onPress={() => toggleEquipment(e)}
              />
            ))}
          </ChipRow>
        </>
      )}
      {step === 4 && (
        <>
          <Text tone="muted" style={{ marginBottom: spacing.lg }}>
            Which unit do you lift in?
          </Text>
          <ChipRow>
            <Chip
              label="Pounds (lb)"
              selected={unit === 'lb'}
              onPress={() => setUnit('lb')}
              testID="unit-lb"
            />
            <Chip
              label="Kilograms (kg)"
              selected={unit === 'kg'}
              onPress={() => setUnit('kg')}
              testID="unit-kg"
            />
          </ChipRow>
        </>
      )}
      {step === 5 && (
        <>
          <Text tone="muted" style={{ marginBottom: spacing.lg }}>
            Pick a starting routine. The first one is our recommendation based on your answers. You can
            customise or build your own later.
          </Text>
          {recommended.map((r, i) => (
            <Card
              key={r.id}
              onPress={() => setRoutineId(r.id)}
              tone={chosen === r.id ? 'primary' : 'default'}
              style={{ marginBottom: spacing.sm }}
              testID={`routine-${r.id}`}
            >
              <View style={styles.rowBetween}>
                <Text weight="semibold">{r.name}</Text>
                {i === 0 ? <Chip label="Recommended" small tone="success" /> : null}
              </View>
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {r.description}
              </Text>
              <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
                {r.templates.map((t) => t.name).join(' · ')}
              </Text>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'space-between' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

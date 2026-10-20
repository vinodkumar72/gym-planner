import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Plus, Trash } from 'lucide-react-native';
import { Button, Card, Field, Screen, Section, Sheet, Stepper, Text, TextField } from '@/components/common';
import { ExercisePicker } from '@/components/exercise/ExercisePicker';
import { getDb } from '@/db/client';
import * as routineRepo from '@/db/repositories/routineRepo';
import { useAsyncData } from '@/hooks/useAsyncData';
import { addTemplateExercise } from '@/services/routineService';
import { describeTarget } from '@/services/templateInfo';
import { useAppStore, useWeightUnit } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';
import { newId, nowIso } from '@/utils/ids';

export default function TemplateEditorScreen() {
  const router = useRouter();
  const { templateId } = useLocalSearchParams<{ templateId: string }>();
  const { spacing, colors } = useTheme();
  const unit = useWeightUnit();
  const bump = useAppStore((s) => s.bump);
  const load = useCallback(() => routineRepo.getTemplateDetail(getDb(), templateId), [templateId]);
  const { data: template } = useAsyncData(load, [templateId]);
  const [picker, setPicker] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');

  if (!template) {
    return (
      <Screen title="Workout">
        <Text tone="muted">Loading…</Text>
      </Screen>
    );
  }
  const editingRow = template.exercises.find((e) => e.id === editing) ?? null;

  const patch = async (id: string, p: Parameters<typeof routineRepo.updateTemplateExercise>[2]) => {
    await routineRepo.updateTemplateExercise(getDb(), id, { ...p, updatedAt: nowIso() });
    bump();
  };
  const move = async (index: number, dir: -1 | 1) => {
    const ids = template.exercises.map((t) => t.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const [a] = ids.splice(index, 1);
    if (a) ids.splice(target, 0, a);
    await routineRepo.reorderTemplateExercises(getDb(), ids, nowIso());
    bump();
  };
  const remove = (id: string, label: string) => {
    Alert.alert('Remove exercise?', `${label} will be removed from this workout. Past sessions are unaffected.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await routineRepo.deleteTemplateExercise(getDb(), id); bump(); } },
    ]);
  };
  const deleteTemplate = () => {
    Alert.alert('Delete workout?', 'This workout day is removed from the routine. History is kept.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await routineRepo.deleteTemplate(getDb(), template.id); bump(); router.back(); } },
    ]);
  };

  return (
    <Screen title={template.name} right={<Button title="Rename" variant="secondary" size="sm" onPress={() => { setName(template.name); setRenaming(true); }} />} testID="template-editor">
      <Section title="Exercises" right={<Button title="Add" size="sm" icon={<Plus size={14} color={colors.textOnPrimary} />} onPress={() => setPicker(true)} testID="add-exercise" />}>
        {template.exercises.length === 0 ? <Text tone="muted">Add exercises to this workout.</Text> : null}
        {template.exercises.map((e, i) => (
          <Card key={e.id} onPress={() => setEditing(e.id)} style={{ marginBottom: spacing.sm }} testID={`template-exercise-${e.id}`}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text weight="semibold">{e.exercise.name}</Text>
                <Text variant="caption" tone="muted">
                  {describeTarget({ ...e, exerciseType: e.exercise.exerciseType })} · rest {e.restSeconds}s
                  {e.exercise.exerciseType === 'strength' && !e.exercise.isBodyweight ? ` · +${e.progressionIncrement} ${e.incrementUnit}` : ''}
                </Text>
              </View>
              <Button title="" variant="ghost" size="sm" icon={<ArrowUp size={18} color={colors.textMuted} />} onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel="Move up" />
              <Button title="" variant="ghost" size="sm" icon={<ArrowDown size={18} color={colors.textMuted} />} onPress={() => move(i, 1)} disabled={i === template.exercises.length - 1} accessibilityLabel="Move down" />
              <Button title="" variant="ghost" size="sm" icon={<Trash size={18} color={colors.danger} />} onPress={() => remove(e.id, e.exercise.name)} accessibilityLabel={`Remove ${e.exercise.name}`} />
            </View>
          </Card>
        ))}
      </Section>
      <Button title="Delete workout" variant="ghost" onPress={deleteTemplate} style={{ marginTop: spacing.xl }} />

      <ExercisePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onSelect={async (ex) => {
          setPicker(false);
          await addTemplateExercise(getDb(), template.id, ex.id, unit, newId);
          bump();
        }}
        onCreateCustom={() => { setPicker(false); router.push('/exercises/new'); }}
      />

      <Sheet visible={editingRow !== null} onClose={() => setEditing(null)} title={editingRow?.exercise.name ?? ''}>
        {editingRow ? (
          <View>
            {editingRow.exercise.exerciseType === 'cardio' ? (
              <>
                <Field label="Target minutes">
                  <Stepper label="target minutes" value={editingRow.targetDurationSeconds === null ? null : Math.round(editingRow.targetDurationSeconds / 60)} step={5} onChange={(v) => patch(editingRow.id, { targetDurationSeconds: v === null ? null : v * 60 })} />
                </Field>
                <Field label="Target distance">
                  <Stepper label="target distance" value={editingRow.targetDistance} step={0.5} decimals={2} onChange={(v) => patch(editingRow.id, { targetDistance: v })} />
                </Field>
              </>
            ) : (
              <>
                <Field label="Sets">
                  <Stepper label="sets" value={editingRow.targetSets} min={1} max={10} onChange={(v) => patch(editingRow.id, { targetSets: v ?? 1 })} />
                </Field>
                {editingRow.exercise.exerciseType === 'duration' ? (
                  <Field label="Target seconds">
                    <Stepper label="target seconds" value={editingRow.targetDurationSeconds} step={5} min={5} onChange={(v) => patch(editingRow.id, { targetDurationSeconds: v ?? 30 })} />
                  </Field>
                ) : (
                  <>
                    <Field label="Min reps">
                      <Stepper label="min reps" value={editingRow.minReps} min={1} max={100} onChange={(v) => patch(editingRow.id, { minReps: Math.min(v ?? 1, editingRow.maxReps) })} />
                    </Field>
                    <Field label="Max reps">
                      <Stepper label="max reps" value={editingRow.maxReps} min={1} max={100} onChange={(v) => patch(editingRow.id, { maxReps: Math.max(v ?? 1, editingRow.minReps) })} />
                    </Field>
                  </>
                )}
                <Field label="Rest (seconds)">
                  <Stepper label="rest seconds" value={editingRow.restSeconds} step={15} min={0} max={600} onChange={(v) => patch(editingRow.id, { restSeconds: v ?? 0 })} />
                </Field>
                <Field label={editingRow.exercise.isBodyweight ? 'Progression (reps)' : editingRow.exercise.exerciseType === 'duration' ? 'Progression (seconds)' : `Progression increment (${editingRow.incrementUnit})`} hint="How much to add when every set hits the top of the range.">
                  <Stepper label="increment" value={editingRow.progressionIncrement} step={editingRow.exercise.isBodyweight ? 1 : editingRow.exercise.exerciseType === 'duration' ? 5 : editingRow.incrementUnit === 'kg' ? 1.25 : 2.5} min={0} decimals={2} onChange={(v) => patch(editingRow.id, { progressionIncrement: v ?? 0 })} />
                </Field>
              </>
            )}
            <Button title="Done" onPress={() => setEditing(null)} />
          </View>
        ) : null}
      </Sheet>
      <Sheet visible={renaming} onClose={() => setRenaming(false)} title="Rename workout">
        <TextField value={name} onChangeText={setName} autoFocus />
        <Button title="Save" onPress={async () => { await routineRepo.updateTemplate(getDb(), template.id, { name: name.trim() || template.name, updatedAt: nowIso() }); setRenaming(false); bump(); }} style={{ marginTop: spacing.md }} />
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center', gap: 2 }, flex: { flex: 1 } });

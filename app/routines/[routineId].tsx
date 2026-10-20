import React, { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, Plus } from 'lucide-react-native';
import { Button, Card, Chip, ChipRow, Field, ListRow, Screen, Section, Sheet, Text, TextField } from '@/components/common';
import { getDb } from '@/db/client';
import * as routineRepo from '@/db/repositories/routineRepo';
import { DAY_SHORT, type RotationType } from '@/domain/models/types';
import { useAsyncData } from '@/hooks/useAsyncData';
import { addTemplate, archiveRoutine, deleteRoutine, duplicateRoutine, unarchiveRoutine } from '@/services/routineService';
import { describeTarget } from '@/services/templateInfo';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';
import { newId, nowIso } from '@/utils/ids';

export default function RoutineDetailScreen() {
  const router = useRouter();
  const { routineId } = useLocalSearchParams<{ routineId: string }>();
  const { spacing, colors } = useTheme();
  const bump = useAppStore((s) => s.bump);
  const load = useCallback(() => routineRepo.getRoutineDetail(getDb(), routineId), [routineId]);
  const { data: routine } = useAsyncData(load, [routineId]);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState('');
  const [addingTemplate, setAddingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [scheduleDay, setScheduleDay] = useState<number | null>(null);

  if (!routine) {
    return (
      <Screen title="Routine">
        <Text tone="muted">Loading…</Text>
      </Screen>
    );
  }

  const activate = async () => {
    await routineRepo.activateRoutine(getDb(), routine.id, nowIso());
    bump();
  };
  const rename = async () => {
    await routineRepo.updateRoutine(getDb(), routine.id, { name: name.trim() || routine.name, updatedAt: nowIso() });
    setRenaming(false);
    bump();
  };
  const setRotation = async (t: RotationType) => {
    await routineRepo.updateRoutine(getDb(), routine.id, { rotationType: t, updatedAt: nowIso() });
    bump();
  };
  const duplicate = async () => {
    const id = await duplicateRoutine(getDb(), routine.id, newId);
    bump();
    router.replace(`/routines/${id}`);
  };
  const archive = () => {
    Alert.alert('Archive routine?', 'Workout history is kept. You can unarchive it later.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        style: 'destructive',
        onPress: async () => {
          await archiveRoutine(getDb(), routine.id);
          bump();
          router.back();
        },
      },
    ]);
  };
  const remove = () => {
    Alert.alert('Delete routine?', 'The routine and its templates are removed. Workout history is never deleted.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteRoutine(getDb(), routine.id);
          bump();
          router.back();
        },
      },
    ]);
  };
  const createTemplate = async () => {
    const id = await addTemplate(getDb(), routine.id, templateName, newId);
    setAddingTemplate(false);
    setTemplateName('');
    bump();
    router.push(`/routines/template/${id}`);
  };
  const move = async (index: number, dir: -1 | 1) => {
    const ids = routine.templates.map((t) => t.id);
    const target = index + dir;
    if (target < 0 || target >= ids.length) return;
    const [a] = ids.splice(index, 1);
    if (a) ids.splice(target, 0, a);
    await routineRepo.reorderTemplates(getDb(), ids, nowIso());
    bump();
  };
  const assignDay = async (templateId: string | null) => {
    if (scheduleDay === null) return;
    await routineRepo.setScheduleDay(getDb(), routine.id, scheduleDay, templateId, newId);
    setScheduleDay(null);
    bump();
  };

  return (
    <Screen title={routine.name} subtitle={routine.description ?? undefined} testID="routine-detail">
      <View style={[styles.row, { gap: spacing.sm, flexWrap: 'wrap' }]}>
        {routine.isActive ? <Chip label="Active routine" tone="success" /> : <Button title="Make active" onPress={activate} testID="activate-routine" />}
        <Button title="Rename" variant="secondary" onPress={() => { setName(routine.name); setRenaming(true); }} />
        <Button title="Duplicate" variant="secondary" onPress={duplicate} />
        {routine.isArchived ? (
          <Button title="Unarchive" variant="secondary" onPress={async () => { await unarchiveRoutine(getDb(), routine.id); bump(); }} />
        ) : (
          <Button title="Archive" variant="ghost" onPress={archive} />
        )}
        {!routine.isBuiltin ? <Button title="Delete" variant="ghost" onPress={remove} /> : null}
      </View>

      <Section title="Scheduling">
        <ChipRow>
          <Chip label="Rotation" selected={routine.rotationType === 'rotation'} onPress={() => setRotation('rotation')} />
          <Chip label="Calendar" selected={routine.rotationType === 'calendar'} onPress={() => setRotation('calendar')} />
        </ChipRow>
        {routine.rotationType === 'calendar' ? (
          <Card style={{ marginTop: spacing.md }}>
            <Text variant="caption" tone="muted" style={{ marginBottom: spacing.sm }}>
              Tap a day to assign a workout.
            </Text>
            {DAY_SHORT.map((d, i) => {
              const entry = routine.schedule.find((s) => s.dayOfWeek === i);
              const t = entry ? routine.templates.find((x) => x.id === entry.templateId) : null;
              return <ListRow key={d} title={d} subtitle={t?.name ?? 'Rest'} onPress={() => setScheduleDay(i)} chevron last={i === 6} />;
            })}
          </Card>
        ) : (
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            Workouts run in the order below, one after another, whenever you train.
          </Text>
        )}
      </Section>

      <Section title="Workouts" right={<Button title="Add" size="sm" icon={<Plus size={14} color={colors.textOnPrimary} />} onPress={() => setAddingTemplate(true)} testID="add-template" />}>
        {routine.templates.length === 0 ? <Text tone="muted">No workouts yet. Add one.</Text> : null}
        {routine.templates.map((t, i) => (
          <Card key={t.id} onPress={() => router.push(`/routines/template/${t.id}`)} style={{ marginBottom: spacing.sm }} testID={`template-${t.id}`}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text variant="subheading">{t.name}</Text>
                {t.exercises.length === 0 ? (
                  <Text variant="caption" tone="muted">
                    No exercises yet
                  </Text>
                ) : (
                  t.exercises.map((e) => (
                    <Text key={e.id} variant="caption" tone="muted">
                      {e.exercise.name} · {describeTarget({ ...e, exerciseType: e.exercise.exerciseType })}
                    </Text>
                  ))
                )}
              </View>
              <View style={{ gap: 4 }}>
                <Button title="" variant="ghost" size="sm" icon={<ArrowUp size={18} color={colors.textMuted} />} onPress={() => move(i, -1)} disabled={i === 0} accessibilityLabel={`Move ${t.name} up`} />
                <Button title="" variant="ghost" size="sm" icon={<ArrowDown size={18} color={colors.textMuted} />} onPress={() => move(i, 1)} disabled={i === routine.templates.length - 1} accessibilityLabel={`Move ${t.name} down`} />
              </View>
            </View>
          </Card>
        ))}
      </Section>

      <Sheet visible={renaming} onClose={() => setRenaming(false)} title="Rename routine">
        <TextField value={name} onChangeText={setName} autoFocus />
        <Button title="Save" onPress={rename} style={{ marginTop: spacing.md }} />
      </Sheet>
      <Sheet visible={addingTemplate} onClose={() => setAddingTemplate(false)} title="New workout">
        <TextField label="Name" placeholder="e.g. Upper A" value={templateName} onChangeText={setTemplateName} autoFocus testID="template-name" />
        <Button title="Add workout" onPress={createTemplate} testID="create-template" />
      </Sheet>
      <Sheet visible={scheduleDay !== null} onClose={() => setScheduleDay(null)} title={scheduleDay !== null ? `${DAY_SHORT[scheduleDay]}: choose workout` : ''}>
        <Field label="Workout">
          {routine.templates.map((t) => (
            <ListRow key={t.id} title={t.name} onPress={() => assignDay(t.id)} />
          ))}
          <ListRow title="Rest day" onPress={() => assignDay(null)} last />
        </Field>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ row: { flexDirection: 'row', alignItems: 'center' }, flex: { flex: 1 } });

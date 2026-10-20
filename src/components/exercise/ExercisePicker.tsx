import React, { useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Chip, ChipRow, ListRow, Sheet, TextField, Text, Button } from '@/components/common';
import { getDb } from '@/db/client';
import { listExercises } from '@/db/repositories/exerciseRepo';
import type { ExerciseRow } from '@/db/schema';
import { MUSCLE_GROUPS } from '@/domain/models/types';
import { useAsyncData } from '@/hooks/useAsyncData';
import { titleCase } from '@/services/templateInfo';
import { useTheme } from '@/theme/ThemeProvider';

export interface ExercisePickerProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (exercise: ExerciseRow) => void;
  title?: string;
  onCreateCustom?: () => void;
}

export function ExercisePicker({ visible, onClose, onSelect, title = 'Choose exercise', onCreateCustom }: ExercisePickerProps) {
  const { spacing } = useTheme();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const load = useCallback(() => listExercises(getDb(), { search, muscleGroup: group ?? undefined }), [search, group]);
  const { data } = useAsyncData(load, [search, group]);
  const rows = useMemo(() => data ?? [], [data]);

  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <TextField placeholder="Search exercises" value={search} onChangeText={setSearch} autoCorrect={false} accessibilityLabel="Search exercises" />
      <View style={{ marginVertical: spacing.sm }}>
        <ChipRow>
          <Chip label="All" small selected={group === null} onPress={() => setGroup(null)} />
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} label={titleCase(g)} small selected={group === g} onPress={() => setGroup(group === g ? null : g)} />
          ))}
        </ChipRow>
      </View>
      <FlatList
        data={rows}
        keyExtractor={(e) => e.id}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <ListRow
            title={item.name}
            subtitle={`${titleCase(item.primaryMuscleGroup)} · ${titleCase(item.equipment)}${item.isCustom ? ' · custom' : ''}`}
            onPress={() => onSelect(item)}
            testID={`pick-exercise-${item.id}`}
          />
        )}
        ListEmptyComponent={<Text tone="muted">No exercises match.</Text>}
      />
      {onCreateCustom ? <Button title="Create custom exercise" variant="ghost" onPress={onCreateCustom} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({ list: { maxHeight: 380 } });

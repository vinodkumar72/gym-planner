import React, { useCallback, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Button, Chip, ChipRow, ListRow, Screen, Text, TextField } from '@/components/common';
import { getDb } from '@/db/client';
import { listExercises } from '@/db/repositories/exerciseRepo';
import { EQUIPMENT, MUSCLE_GROUPS } from '@/domain/models/types';
import { useAsyncData } from '@/hooks/useAsyncData';
import { titleCase } from '@/services/templateInfo';
import { useTheme } from '@/theme/ThemeProvider';

export default function ExerciseLibraryScreen() {
  const router = useRouter();
  const { spacing, colors } = useTheme();
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const load = useCallback(() => listExercises(getDb(), { search, muscleGroup: group ?? undefined, equipment: equipment ?? undefined }), [search, group, equipment]);
  const { data } = useAsyncData(load, [search, group, equipment]);

  return (
    <Screen title="Exercise library" scroll={false} right={<Button title="New" size="sm" icon={<Plus size={14} color={colors.textOnPrimary} />} onPress={() => router.push('/exercises/new')} />}>
      <TextField placeholder="Search" value={search} onChangeText={setSearch} autoCorrect={false} />
      <View style={{ marginVertical: spacing.sm }}>
        <ChipRow>
          <Chip label="All muscles" small selected={group === null} onPress={() => setGroup(null)} />
          {MUSCLE_GROUPS.map((g) => (
            <Chip key={g} label={titleCase(g)} small selected={group === g} onPress={() => setGroup(group === g ? null : g)} />
          ))}
        </ChipRow>
      </View>
      <View style={{ marginBottom: spacing.sm }}>
        <ChipRow>
          <Chip label="Any equipment" small selected={equipment === null} onPress={() => setEquipment(null)} />
          {EQUIPMENT.map((e) => (
            <Chip key={e} label={titleCase(e)} small selected={equipment === e} onPress={() => setEquipment(equipment === e ? null : e)} />
          ))}
        </ChipRow>
      </View>
      <FlatList
        data={data ?? []}
        keyExtractor={(e) => e.id}
        renderItem={({ item }) => (
          <ListRow title={item.name} subtitle={`${titleCase(item.primaryMuscleGroup)} · ${titleCase(item.equipment)}${item.isCustom ? ' · custom' : ''}`} onPress={() => router.push(`/exercises/${item.id}`)} chevron />
        )}
        ListEmptyComponent={<Text tone="muted">No exercises match.</Text>}
        ListFooterComponent={
          <Text variant="caption" tone="muted" style={{ marginVertical: spacing.lg }}>
            {data?.length ?? 0} exercises
          </Text>
        }
      />
    </Screen>
  );
}

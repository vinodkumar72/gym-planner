import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { Button, Card, Chip, Screen, Section, Text } from '@/components/common';
import { getDb } from '@/db/client';
import { listRoutines, getTemplatesForRoutine } from '@/db/repositories/routineRepo';
import { useAsyncData } from '@/hooks/useAsyncData';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function RoutinesScreen() {
  const router = useRouter();
  const { spacing, colors } = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  useAppStore((s) => s.dataVersion);
  const load = useCallback(async () => {
    const db = getDb();
    const routines = await listRoutines(db, true);
    const withTemplates = [];
    for (const r of routines) {
      const templates = await getTemplatesForRoutine(db, r.id);
      withTemplates.push({ ...r, templates });
    }
    return withTemplates;
  }, []);
  const { data } = useAsyncData(load, []);
  const active = data?.filter((r) => r.isArchived === 0) ?? [];
  const archived = data?.filter((r) => r.isArchived === 1) ?? [];

  const card = (r: NonNullable<typeof data>[number]) => (
    <Card key={r.id} onPress={() => router.push(`/routines/${r.id}`)} style={{ marginBottom: spacing.sm }} tone={r.isActive ? 'primary' : 'default'} testID={`routine-${r.id}`}>
      <View style={styles.rowBetween}>
        <Text variant="subheading" style={styles.flex}>
          {r.name}
        </Text>
        {r.isActive ? <Chip label="Active" small tone="success" /> : null}
      </View>
      <Text variant="caption" tone="muted" style={{ marginTop: 4 }}>
        {r.rotationType === 'calendar' ? 'Calendar' : 'Rotation'} · {r.templates.length} workout{r.templates.length === 1 ? '' : 's'}
        {r.isBuiltin ? ' · built-in' : ''}
      </Text>
      {r.templates.length ? (
        <Text variant="caption" tone="muted" numberOfLines={1}>
          {r.templates.map((t) => t.name).join(' · ')}
        </Text>
      ) : null}
    </Card>
  );

  return (
    <Screen title="Routines" right={<Button title="New" size="sm" icon={<Plus size={16} color={colors.textOnPrimary} />} onPress={() => router.push('/routines/new')} testID="new-routine" />}>
      {active.map(card)}
      {active.length === 0 && data ? <Text tone="muted">No routines. Create one to get started.</Text> : null}
      {archived.length > 0 ? (
        <Section title="Archived" right={<Button title={showArchived ? 'Hide' : 'Show'} variant="ghost" size="sm" onPress={() => setShowArchived((v) => !v)} />}>
          {showArchived ? archived.map(card) : null}
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, flex: { flex: 1 } });

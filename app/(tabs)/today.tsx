import React, { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Bed, Clock, Flame, Play, RotateCcw } from 'lucide-react-native';
import { Button, Card, Chip, ChipRow, Screen, Section, Sheet, Text } from '@/components/common';
import { getDb } from '@/db/client';
import { getLastCompletedSession, getSessionDetail, type SessionDetail } from '@/db/repositories/sessionRepo';
import { getRoutineDetail, getActiveRoutine } from '@/db/repositories/routineRepo';
import { READINESS_OPTIONS, exerciseKind, type Readiness } from '@/domain/models/types';
import type { Recommendation, WorkoutOption } from '@/domain/workout-engine';
import { useAsyncData } from '@/hooks/useAsyncData';
import { progressOverview } from '@/services/historyService';
import { getTodayRecommendation } from '@/services/recommendationService';
import { getTemplateInfo, titleCase, type TemplateInfo } from '@/services/templateInfo';
import { useAppStore, useWeightUnit } from '@/stores/appStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';
import { formatDuration } from '@/utils/units';
import { sessionTotals, summarizeSets } from '@/utils/formatSets';

interface TodayData {
  reco: Recommendation;
  infos: Record<string, TemplateInfo>;
  last: SessionDetail | null;
  overview: Awaited<ReturnType<typeof progressOverview>>;
  routineName: string | null;
  allTemplates: { id: string; name: string }[];
}

export default function TodayScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const unit = useWeightUnit();
  const readiness = useAppStore((s) => s.getReadiness());
  const setReadiness = useAppStore((s) => s.setReadiness);
  const start = useWorkoutStore((s) => s.start);
  const busy = useWorkoutStore((s) => s.busy);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [checkinOpen, setCheckinOpen] = useState(false);

  const load = useCallback(async (): Promise<TodayData> => {
    const db = getDb();
    const reco = await getTodayRecommendation(db, readiness);
    const ids: string[] = [];
    if (reco.kind === 'workout') ids.push(reco.option.templateId);
    if (reco.kind === 'choice')
      ids.push(reco.missed.templateId, ...(reco.scheduled ? [reco.scheduled.templateId] : []));
    if (reco.kind === 'rest_day' && reco.override) {
      if (reco.override.kind === 'workout') ids.push(reco.override.option.templateId);
      else
        ids.push(
          reco.override.missed.templateId,
          ...(reco.override.scheduled ? [reco.override.scheduled.templateId] : []),
        );
    }
    const infos: Record<string, TemplateInfo> = {};
    for (const id of ids) {
      const info = await getTemplateInfo(db, id);
      if (info) infos[id] = info;
    }
    const active = await getActiveRoutine(db);
    const detail = active ? await getRoutineDetail(db, active.id) : null;
    return {
      reco,
      infos,
      last: await (async () => {
        const row = await getLastCompletedSession(db);
        return row ? getSessionDetail(db, row.id) : null;
      })(),
      overview: await progressOverview(db, new Date(), 4),
      routineName: active?.name ?? null,
      allTemplates: detail?.templates.map((t) => ({ id: t.id, name: t.name })) ?? [],
    };
  }, [readiness]);
  const { data, loading, error } = useAsyncData(load, [readiness]);

  const begin = async (templateId: string) => {
    const id = await start(templateId, readiness);
    router.push(`/workout/${id}`);
  };

  const optionCard = (o: WorkoutOption, label: string, primary: boolean) => {
    const info = data?.infos[o.templateId];
    return (
      <Card
        key={`${o.templateId}-${o.role}`}
        tone={primary ? 'primary' : 'default'}
        style={{ marginBottom: spacing.md }}
        testID={`option-${o.templateId}`}
      >
        <Text variant="label" tone={primary ? 'primary' : 'muted'}>
          {label}
        </Text>
        <Text variant="title" style={{ marginTop: 4 }}>
          {o.templateName}
        </Text>
        {o.intensity === 'reduced' ? <Chip label="Reduced intensity suggested" small tone="warning" /> : null}
        {info ? (
          <>
            <View style={[styles.row, { marginTop: spacing.sm, gap: spacing.sm }]}>
              <Clock size={16} color={colors.textMuted} />
              <Text variant="caption" tone="muted">
                ~{info.estimatedMinutes} min · {info.exercises.length} exercises
              </Text>
            </View>
            <ChipRow>
              {info.muscleGroups.map((g) => (
                <Chip key={g} label={titleCase(g)} small />
              ))}
            </ChipRow>
            <View style={{ marginTop: spacing.sm }}>
              {info.exercises.map((e) => (
                <Text key={e.id} variant="caption" tone="muted">
                  {e.name} · {e.summary}
                </Text>
              ))}
            </View>
          </>
        ) : null}
        <Button
          title={o.role === 'missed' ? 'Do missed workout' : 'Start workout'}
          size="lg"
          fullWidth
          icon={<Play size={20} color={colors.textOnPrimary} />}
          onPress={() => begin(o.templateId)}
          loading={busy}
          style={{ marginTop: spacing.lg }}
          testID={`start-${o.templateId}`}
        />
      </Card>
    );
  };

  const renderReco = (reco: Recommendation) => {
    switch (reco.kind) {
      case 'resume':
        return (
          <Card tone="warning" style={{ marginBottom: spacing.md }} testID="resume-card">
            <Text variant="label" tone="warning">
              Unfinished workout
            </Text>
            <Text variant="title" style={{ marginTop: 4 }}>
              {reco.templateName}
            </Text>
            <Text tone="muted" style={{ marginTop: 4 }}>
              Started {new Date(reco.startedAt).toLocaleString()}
            </Text>
            <Button
              title="Resume workout"
              size="lg"
              fullWidth
              icon={<RotateCcw size={20} color={colors.textOnPrimary} />}
              onPress={() => router.push(`/workout/${reco.sessionId}`)}
              style={{ marginTop: spacing.lg }}
              testID="resume-button"
            />
          </Card>
        );
      case 'workout':
        return optionCard(reco.option, "Today's workout", true);
      case 'choice':
        return (
          <>
            <Text tone="muted" style={{ marginBottom: spacing.md }}>
              {reco.reason}
            </Text>
            {optionCard(reco.missed, `Missed · ${reco.missed.scheduledFor}`, true)}
            {reco.scheduled ? optionCard(reco.scheduled, 'Scheduled today', false) : null}
          </>
        );
      case 'rest_day':
        return (
          <Card tone="success" style={{ marginBottom: spacing.md }} testID="rest-card">
            <View style={[styles.row, { gap: spacing.sm }]}>
              <Bed size={22} color={colors.success} />
              <Text variant="heading">Rest day</Text>
            </View>
            <Text tone="muted" style={{ marginTop: spacing.sm }}>
              {reco.reason}
            </Text>
            {reco.override ? (
              <Button
                title="Train anyway"
                variant="secondary"
                onPress={() => setPickerOpen(true)}
                style={{ marginTop: spacing.md }}
              />
            ) : null}
          </Card>
        );
      case 'no_routine':
        return (
          <Card style={{ marginBottom: spacing.md }}>
            <Text variant="heading">No active routine</Text>
            <Text tone="muted" style={{ marginTop: spacing.sm }}>
              {reco.reason}
            </Text>
            <Button
              title="Choose a routine"
              onPress={() => router.push('/(tabs)/routines')}
              style={{ marginTop: spacing.md }}
            />
          </Card>
        );
    }
  };

  const todayLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });

  return (
    <Screen title="Today" subtitle={todayLabel} testID="today-screen">
      <View style={[styles.row, { justifyContent: 'space-between', marginBottom: spacing.md }]}>
        <Text variant="caption" tone="muted">
          {data?.routineName ? `Routine: ${data.routineName}` : ''}
        </Text>
        <Chip
          label={
            readiness
              ? `Feeling: ${READINESS_OPTIONS.find((r) => r.value === readiness)?.label ?? readiness}`
              : 'How are you feeling?'
          }
          small
          tone={readiness ? 'primary' : 'default'}
          onPress={() => setCheckinOpen(true)}
          testID="readiness-chip"
        />
      </View>

      {error ? (
        <Card tone="danger">
          <Text tone="danger">{error}</Text>
        </Card>
      ) : null}
      {data ? renderReco(data.reco) : loading ? <Text tone="muted">Loading…</Text> : null}

      {data && data.reco.kind !== 'resume' && data.allTemplates.length > 0 ? (
        <Button
          title="Train something else"
          variant="ghost"
          onPress={() => setPickerOpen(true)}
          testID="train-other"
        />
      ) : null}

      <Section title="Last workout">
        {data?.last ? (
          <Card onPress={() => router.push(`/history/${data.last?.id}`)} testID="last-workout-card">
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text weight="semibold" style={styles.flex}>
                {data.last.templateNameSnapshot || 'Workout'}
              </Text>
              <Text variant="caption" tone="muted">
                {new Date(data.last.startedAt).toLocaleDateString(undefined, {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </Text>
            </View>
            {(() => {
              const totals = sessionTotals(data.last.exercises, unit);
              return (
                <Text variant="caption" tone="muted" style={{ marginTop: 2 }}>
                  {formatDuration(data.last.durationSeconds)} · {totals.sets} set
                  {totals.sets === 1 ? '' : 's'}
                  {totals.volume > 0 ? ` · ${totals.volume.toLocaleString()} ${unit} volume` : ''}
                </Text>
              );
            })()}
            <View style={{ marginTop: spacing.sm, gap: 2 }}>
              {data.last.exercises.map((e) => {
                const summary = summarizeSets(
                  e.sets,
                  exerciseKind(e.exercise.exerciseType, e.exercise.isBodyweight),
                  unit,
                );
                if (!summary) return null;
                const weighted = !e.exercise.isBodyweight && e.exercise.exerciseType === 'strength';
                return (
                  <View key={e.id} style={styles.row}>
                    <Text variant="caption" style={styles.exerciseName} numberOfLines={1}>
                      {e.exerciseNameSnapshot || e.exercise.name}
                    </Text>
                    <Text variant="caption" tone="muted" style={styles.flex} numberOfLines={1}>
                      {summary}
                      {weighted ? ` (${unit}×reps)` : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
            <Text variant="caption" tone="primary" style={{ marginTop: spacing.sm }}>
              View details
            </Text>
          </Card>
        ) : (
          <Text tone="muted">No workouts yet. Your first one starts above.</Text>
        )}
      </Section>

      {data ? (
        <Section title="This week">
          <View style={[styles.row, { gap: spacing.md }]}>
            <Card style={styles.stat}>
              <Flame size={18} color={colors.warning} />
              <Text variant="heading">{data.overview.streaks.thisWeekSessions}</Text>
              <Text variant="caption" tone="muted">
                sessions
              </Text>
            </Card>
            <Card style={styles.stat}>
              <Text variant="heading">{data.overview.streaks.currentWeekStreak}</Text>
              <Text variant="caption" tone="muted">
                week streak
              </Text>
            </Card>
            <Card style={styles.stat}>
              <Text variant="heading">{data.overview.totalSessions}</Text>
              <Text variant="caption" tone="muted">
                total
              </Text>
            </Card>
          </View>
        </Section>
      ) : null}

      <Sheet visible={checkinOpen} onClose={() => setCheckinOpen(false)} title="How are you feeling today?">
        <Text tone="muted" style={{ marginBottom: spacing.md }}>
          This only adjusts today&apos;s suggestion. It isn&apos;t medical advice, and you can always override
          it.
        </Text>
        {READINESS_OPTIONS.map((o) => (
          <Card
            key={o.value}
            onPress={() => {
              setReadiness(o.value as Readiness);
              setCheckinOpen(false);
            }}
            tone={readiness === o.value ? 'primary' : 'default'}
            style={{ marginBottom: spacing.sm }}
            testID={`readiness-${o.value}`}
          >
            <Text weight="semibold">{o.label}</Text>
            <Text variant="caption" tone="muted">
              {o.hint}
            </Text>
          </Card>
        ))}
        {readiness ? (
          <Button
            title="Clear check-in"
            variant="ghost"
            onPress={() => {
              setReadiness(null);
              setCheckinOpen(false);
            }}
          />
        ) : null}
      </Sheet>

      <Sheet visible={pickerOpen} onClose={() => setPickerOpen(false)} title="Pick a workout">
        {data?.allTemplates.map((t) => (
          <Card
            key={t.id}
            onPress={() => {
              setPickerOpen(false);
              void begin(t.id);
            }}
            style={{ marginBottom: spacing.sm }}
            testID={`pick-${t.id}`}
          >
            <Text weight="semibold">{t.name}</Text>
          </Card>
        ))}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  exerciseName: { width: 128, marginRight: 8 },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
});

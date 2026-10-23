import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, Upload } from 'lucide-react-native';
import { Button, Card, Field, Screen, Section, Sheet, Text, TextField } from '@/components/common';
import {
  applyBackup,
  interpretBackupText,
  pickBackupFile,
  prepareBackupFile,
  shareBackupFile,
  type ExportStage,
  type PickResult,
} from '@/services/backup/fileIo';
import { useAppStore } from '@/stores/appStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';

const STAGE_LABEL: Record<ExportStage, string> = {
  reading: 'Reading your data…',
  encrypting: 'Encrypting…',
  writing: 'Writing file…',
  sharing: 'Opening share sheet…',
};

export default function BackupScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const bump = useAppStore((s) => s.bump);
  const reloadPrefs = useAppStore((s) => s.load);
  const hydrate = useWorkoutStore((s) => s.hydrate);
  const [busy, setBusy] = useState<string | null>(null);
  const [stage, setStage] = useState<ExportStage | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [pending, setPending] = useState<PickResult | null>(null);
  const [importPass, setImportPass] = useState('');

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    try {
      await fn();
    } catch (e) {
      Alert.alert('Something went wrong', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setStage(null);
    }
  };

  const doExport = () =>
    run('export', async () => {
      const prepared = await prepareBackupFile(passphrase || undefined, setStage);
      setStage('sharing');
      await shareBackupFile(prepared);
      setLastExport(
        `${prepared.fileName} (${Math.round(prepared.bytes / 1024)} KB${prepared.encrypted ? ', encrypted' : ''})`,
      );
      setPassphrase('');
    });

  const doPick = () =>
    run('pick', async () => {
      const res = await pickBackupFile();
      if (res.kind === 'canceled') return;
      if (res.kind === 'error') {
        Alert.alert('Cannot restore', res.error);
        return;
      }
      setPending(res);
    });

  const unlock = () => {
    if (!pending || pending.kind !== 'needs_passphrase') return;
    const res = interpretBackupText(pending.text, pending.fileName, importPass);
    if (res.kind === 'error') Alert.alert('Cannot restore', res.error);
    else setPending(res);
    setImportPass('');
  };

  const confirmRestore = () => {
    if (!pending || pending.kind !== 'ready') return;
    const p = pending;
    Alert.alert(
      'Replace all current data?',
      `Everything on this device will be replaced with the backup from ${new Date(p.preview.exportedAt).toLocaleString()}. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Replace',
          style: 'destructive',
          onPress: () =>
            run('restore', async () => {
              await applyBackup(p.backup);
              await reloadPrefs();
              await hydrate();
              bump();
              setPending(null);
              Alert.alert('Restore complete', 'Your data has been restored.', [
                { text: 'OK', onPress: () => router.replace('/(tabs)/today') },
              ]);
            }),
        },
      ],
    );
  };

  return (
    <Screen title="Backup & restore" testID="backup-screen">
      <Text tone="muted">
        A backup is a single .json file containing everything in the app. Keep it somewhere safe; the same
        file is what Import reads back. Nothing is uploaded unless you share the file to a service yourself.
      </Text>

      <Section title="Export">
        <Card>
          <Field
            label="Passphrase (optional)"
            hint="With a passphrase the file is encrypted (AES-256-GCM) and the passphrase is required to restore it. Leave empty for a plain, readable file."
          >
            <TextField
              value={passphrase}
              onChangeText={setPassphrase}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="Leave empty for an unencrypted backup"
              editable={busy === null}
            />
          </Field>
          <Button
            title={passphrase ? 'Export encrypted backup' : 'Export backup'}
            icon={<Download size={18} color={colors.textOnPrimary} />}
            onPress={doExport}
            loading={busy === 'export'}
            disabled={busy !== null}
            fullWidth
            testID="export-backup"
          />
          {stage ? (
            <Text
              variant="caption"
              tone="muted"
              center
              style={{ marginTop: spacing.sm }}
              accessibilityLiveRegion="polite"
            >
              {STAGE_LABEL[stage]}
            </Text>
          ) : null}
          {lastExport && !stage ? (
            <Text variant="caption" tone="success" center style={{ marginTop: spacing.sm }}>
              Exported {lastExport}
            </Text>
          ) : null}
        </Card>
      </Section>

      <Section title="Restore">
        <Card>
          <Button
            title="Import backup (.json)"
            variant="secondary"
            icon={<Upload size={18} color={colors.text} />}
            onPress={doPick}
            loading={busy === 'pick'}
            disabled={busy !== null}
            fullWidth
            testID="import-backup"
          />
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            You will see a preview and must confirm before anything is replaced. Restoring is all-or-nothing.
          </Text>
        </Card>
      </Section>

      <Sheet visible={pending !== null} onClose={() => setPending(null)} title="Restore backup">
        {pending?.kind === 'needs_passphrase' ? (
          <View>
            <Text tone="muted" style={{ marginBottom: spacing.md }}>
              {pending.fileName} is encrypted. Enter its passphrase.
            </Text>
            <TextField
              value={importPass}
              onChangeText={setImportPass}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
            />
            <Button title="Unlock" onPress={unlock} style={{ marginTop: spacing.md }} fullWidth />
          </View>
        ) : null}
        {pending?.kind === 'ready' ? (
          <View>
            <Text weight="semibold">{pending.fileName}</Text>
            <Text variant="caption" tone="muted">
              Exported {new Date(pending.preview.exportedAt).toLocaleString()} · app{' '}
              {pending.preview.appVersion} · data v{pending.preview.schemaVersion}
            </Text>
            <View style={[styles.grid, { marginTop: spacing.md }]}>
              {[
                ['Completed workouts', pending.preview.completedSessions],
                ['Sets', pending.preview.counts.exercise_sets],
                ['Routines', pending.preview.counts.routines],
                ['Exercises', pending.preview.counts.exercises],
              ].map(([k, v]) => (
                <Card key={String(k)} style={styles.stat}>
                  <Text variant="heading">{v}</Text>
                  <Text variant="caption" tone="muted">
                    {k}
                  </Text>
                </Card>
              ))}
            </View>
            {pending.preview.dateRange ? (
              <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
                Workouts from {pending.preview.dateRange.from} to {pending.preview.dateRange.to}
              </Text>
            ) : null}
            <Button
              title="Replace all data with this backup"
              variant="danger"
              onPress={confirmRestore}
              loading={busy === 'restore'}
              fullWidth
              style={{ marginTop: spacing.lg }}
              testID="confirm-restore"
            />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { width: '47%', alignItems: 'center' },
});

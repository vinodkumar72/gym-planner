import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Download, FileText, Upload } from 'lucide-react-native';
import { Button, Card, Field, Screen, Section, Sheet, Text, TextField } from '@/components/common';
import { applyBackup, exportBackupFile, exportCsvFile, interpretBackupText, pickBackupFile, type PickResult } from '@/services/backup/fileIo';
import { useAppStore } from '@/stores/appStore';
import { useWorkoutStore } from '@/stores/workoutStore';
import { useTheme } from '@/theme/ThemeProvider';

export default function BackupScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const bump = useAppStore((s) => s.bump);
  const reloadPrefs = useAppStore((s) => s.load);
  const hydrate = useWorkoutStore((s) => s.hydrate);
  const [busy, setBusy] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [passphrase, setPassphrase] = useState('');
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
    }
  };

  const doExport = (pass?: string) =>
    run('export', async () => {
      setExportOpen(false);
      await exportBackupFile(pass || undefined);
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
    Alert.alert('Replace all current data?', `Everything on this device will be replaced with the backup from ${new Date(p.preview.exportedAt).toLocaleString()}. This cannot be undone.`, [
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
            Alert.alert('Restore complete', 'Your data has been restored.', [{ text: 'OK', onPress: () => router.replace('/(tabs)/today') }]);
          }),
      },
    ]);
  };

  return (
    <Screen title="Backup & restore" testID="backup-screen">
      <Text tone="muted">
        Backups are files you keep. Nothing is uploaded anywhere unless you share the file to a service yourself.
      </Text>
      <Section title="Export">
        <Card>
          <Button title="Export backup (.json)" icon={<Download size={18} color={colors.textOnPrimary} />} onPress={() => setExportOpen(true)} loading={busy === 'export'} fullWidth testID="export-backup" />
          <Button title="Export workout history (.csv)" variant="secondary" icon={<FileText size={18} color={colors.text} />} onPress={() => run('csv', exportCsvFile)} loading={busy === 'csv'} fullWidth style={{ marginTop: spacing.sm }} />
        </Card>
      </Section>
      <Section title="Restore">
        <Card>
          <Button title="Import backup" variant="secondary" icon={<Upload size={18} color={colors.text} />} onPress={doPick} loading={busy === 'pick'} fullWidth testID="import-backup" />
          <Text variant="caption" tone="muted" style={{ marginTop: spacing.sm }}>
            You will see a preview and must confirm before anything is replaced. Restoring is all-or-nothing.
          </Text>
        </Card>
      </Section>

      <Sheet visible={exportOpen} onClose={() => setExportOpen(false)} title="Export backup">
        <Field label="Passphrase (optional)" hint="With a passphrase the file is encrypted (AES-256-GCM). Without one it is plain, readable JSON. There is no way to recover a forgotten passphrase.">
          <TextField value={passphrase} onChangeText={setPassphrase} secureTextEntry autoCapitalize="none" placeholder="Leave empty for an unencrypted backup" />
        </Field>
        <Button title={passphrase ? 'Export encrypted backup' : 'Export unencrypted backup'} onPress={() => doExport(passphrase)} fullWidth />
      </Sheet>

      <Sheet visible={pending !== null} onClose={() => setPending(null)} title="Restore backup">
        {pending?.kind === 'needs_passphrase' ? (
          <View>
            <Text tone="muted" style={{ marginBottom: spacing.md }}>
              {pending.fileName} is encrypted. Enter its passphrase.
            </Text>
            <TextField value={importPass} onChangeText={setImportPass} secureTextEntry autoCapitalize="none" autoFocus />
            <Button title="Unlock" onPress={unlock} style={{ marginTop: spacing.md }} fullWidth />
          </View>
        ) : null}
        {pending?.kind === 'ready' ? (
          <View>
            <Text weight="semibold">{pending.fileName}</Text>
            <Text variant="caption" tone="muted">
              Exported {new Date(pending.preview.exportedAt).toLocaleString()} · app {pending.preview.appVersion} · data v{pending.preview.schemaVersion}
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
            <Button title="Replace all data with this backup" variant="danger" onPress={confirmRestore} loading={busy === 'restore'} fullWidth style={{ marginTop: spacing.lg }} testID="confirm-restore" />
          </View>
        ) : null}
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, stat: { width: '47%', alignItems: 'center' } });

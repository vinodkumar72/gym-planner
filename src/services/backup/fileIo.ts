import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { getDb } from '@/db/client';
import { backupToCsv, buildBackup, parseBackup, restoreBackup, serializeBackup, type BackupEnvelope, type BackupPreview } from './core';
import { decryptEnvelope, encryptText, isEncryptedEnvelope } from './crypto';

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

async function shareText(name: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  await file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name, UTI: mimeType === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json' });
  } else {
    throw new Error(`Sharing is not available on this device. File saved at ${file.uri}`);
  }
}

/** Exports all data. With a passphrase the file is AES-256-GCM encrypted; otherwise it is plain JSON. */
export async function exportBackupFile(passphrase?: string): Promise<{ encrypted: boolean }> {
  const backup = await buildBackup(getDb(), appVersion());
  const json = serializeBackup(backup);
  const encrypted = !!passphrase;
  const content = encrypted ? JSON.stringify(encryptText(json, passphrase, (n) => Crypto.getRandomBytes(n))) : json;
  await shareText(`gym-planner-backup-${stamp()}${encrypted ? '.encrypted' : ''}.json`, content, 'application/json');
  return { encrypted };
}

export async function exportCsvFile(): Promise<void> {
  const backup = await buildBackup(getDb(), appVersion());
  await shareText(`gym-planner-workouts-${stamp()}.csv`, backupToCsv(backup), 'text/csv');
}

export type PickResult =
  | { kind: 'canceled' }
  | { kind: 'error'; error: string }
  | { kind: 'needs_passphrase'; text: string; fileName: string }
  | { kind: 'ready'; backup: BackupEnvelope; preview: BackupPreview; fileName: string };

/** Opens the system file picker and validates the chosen backup. Does not modify any data. */
export async function pickBackupFile(): Promise<PickResult> {
  const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (res.canceled) return { kind: 'canceled' };
  const asset = res.assets[0];
  if (!asset) return { kind: 'canceled' };
  let text: string;
  try {
    text = await new File(asset.uri).text();
  } catch (e) {
    return { kind: 'error', error: `Could not read the file: ${e instanceof Error ? e.message : String(e)}` };
  }
  return interpretBackupText(text, asset.name);
}

export function interpretBackupText(text: string, fileName: string, passphrase?: string): PickResult {
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  if (isEncryptedEnvelope(json)) {
    if (!passphrase) return { kind: 'needs_passphrase', text, fileName };
    try {
      text = decryptEnvelope(json, passphrase);
    } catch (e) {
      return { kind: 'error', error: e instanceof Error ? e.message : String(e) };
    }
  }
  const parsed = parseBackup(text);
  if (!parsed.ok) return { kind: 'error', error: parsed.error };
  return { kind: 'ready', backup: parsed.backup, preview: parsed.preview, fileName };
}

export async function applyBackup(backup: BackupEnvelope): Promise<void> {
  await restoreBackup(getDb(), backup);
}

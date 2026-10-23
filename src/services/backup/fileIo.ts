import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import Constants from 'expo-constants';
import { getDb } from '@/db/client';
import {
  buildBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  type BackupEnvelope,
  type BackupPreview,
} from './core';
import { decryptEnvelope, encryptText, isEncryptedEnvelope } from './crypto';

function stamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

function appVersion(): string {
  return Constants.expoConfig?.version ?? '1.0.0';
}

export type ExportStage = 'reading' | 'encrypting' | 'writing' | 'sharing';

export interface PreparedBackup {
  uri: string;
  fileName: string;
  bytes: number;
  encrypted: boolean;
}

/**
 * Step 1 of an export: read the database and write the backup file into the app cache.
 * Pure file work, no UI, so it can run while any sheet is still open.
 */
export async function prepareBackupFile(
  passphrase: string | undefined,
  onStage: (s: ExportStage) => void = () => undefined,
): Promise<PreparedBackup> {
  onStage('reading');
  const backup = await buildBackup(getDb(), appVersion());
  const json = serializeBackup(backup);
  const encrypted = !!passphrase;
  let content = json;
  if (passphrase) {
    onStage('encrypting');
    content = JSON.stringify(encryptText(json, passphrase, (n) => Crypto.getRandomBytes(n)));
  }
  onStage('writing');
  const fileName = `gym-planner-backup-${stamp()}${encrypted ? '.encrypted' : ''}.json`;
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true, intermediates: true });
  file.write(content);
  if (!file.exists) throw new Error('The backup file could not be written to the app cache.');
  return { uri: file.uri, fileName, bytes: content.length, encrypted };
}

/** Step 2 of an export: hand the file to the system share sheet. Resolves when the sheet closes. */
export async function shareBackupFile(prepared: PreparedBackup): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error(`Sharing is not available on this device. The file is at ${prepared.uri}`);
  }
  await Sharing.shareAsync(prepared.uri, {
    mimeType: 'application/json',
    dialogTitle: prepared.fileName,
    UTI: 'public.json',
  });
}

export type PickResult =
  | { kind: 'canceled' }
  | { kind: 'error'; error: string }
  | { kind: 'needs_passphrase'; text: string; fileName: string }
  | { kind: 'ready'; backup: BackupEnvelope; preview: BackupPreview; fileName: string };

/** Opens the system file picker and validates the chosen backup. Does not modify any data. */
export async function pickBackupFile(): Promise<PickResult> {
  const res = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'text/plain', '*/*'],
    copyToCacheDirectory: true,
    multiple: false,
  });
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

import { gcm } from '@noble/ciphers/aes.js';
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js';
import { scrypt } from '@noble/hashes/scrypt.js';

/**
 * Passphrase-protected backup container. AES-256-GCM with a key derived by scrypt.
 * Pure JavaScript (@noble), so it works offline and in tests. The caller supplies random bytes.
 */
export const ENCRYPTED_FORMAT = 'gym-planner-backup-encrypted';
const SCRYPT = { N: 2 ** 14, r: 8, p: 1, dkLen: 32 };

export interface EncryptedEnvelope {
  format: typeof ENCRYPTED_FORMAT;
  version: 1;
  kdf: 'scrypt';
  params: { N: number; r: number; p: number };
  salt: string;
  nonce: string;
  ciphertext: string;
}

export type RandomBytes = (n: number) => Uint8Array;

function deriveKey(passphrase: string, salt: Uint8Array, params: { N: number; r: number; p: number }): Uint8Array {
  return scrypt(utf8ToBytes(passphrase.normalize('NFKC')), salt, { ...params, dkLen: SCRYPT.dkLen });
}

export function encryptText(plaintext: string, passphrase: string, random: RandomBytes): EncryptedEnvelope {
  if (!passphrase) throw new Error('A passphrase is required');
  const salt = random(16);
  const nonce = random(12);
  const key = deriveKey(passphrase, salt, SCRYPT);
  const ciphertext = gcm(key, nonce).encrypt(utf8ToBytes(plaintext));
  return {
    format: ENCRYPTED_FORMAT,
    version: 1,
    kdf: 'scrypt',
    params: { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p },
    salt: bytesToHex(salt),
    nonce: bytesToHex(nonce),
    ciphertext: bytesToHex(ciphertext),
  };
}

export function isEncryptedEnvelope(v: unknown): v is EncryptedEnvelope {
  return typeof v === 'object' && v !== null && (v as { format?: unknown }).format === ENCRYPTED_FORMAT;
}

export function decryptEnvelope(env: EncryptedEnvelope, passphrase: string): string {
  if (env.version !== 1 || env.kdf !== 'scrypt') throw new Error('Unsupported encrypted backup version');
  if (env.params.N > 2 ** 20) throw new Error('Unsupported key derivation parameters');
  const key = deriveKey(passphrase, hexToBytes(env.salt), env.params);
  try {
    return bytesToUtf8(gcm(key, hexToBytes(env.nonce)).decrypt(hexToBytes(env.ciphertext)));
  } catch {
    throw new Error('Wrong passphrase or corrupted file');
  }
}

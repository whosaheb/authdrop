import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';

/** Pure crypto primitives. Stateless so they are trivially unit-testable. */

export const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

export const hmacSha256Hex = (value: string, key: string | Buffer): string =>
  createHmac('sha256', key).update(value).digest('hex');

/** URL-safe random token with `bytes` of entropy (default 256 bit). */
export const randomToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');

/** Uniformly distributed numeric code, zero padded (rejection sampling via crypto.randomInt). */
export const randomNumericCode = (digits = 6): string => randomInt(0, 10 ** digits).toString().padStart(digits, '0');

/** Constant-time string comparison that tolerates different lengths. */
export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) {
    timingSafeEqual(left, left); // keep timing roughly independent of the mismatch
    return false;
  }
  return timingSafeEqual(left, right);
}

// No 0/O/1/I/L to avoid transcription mistakes when users type codes from paper.
const BACKUP_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Single-use recovery code formatted as XXXXX-XXXXX (~50 bits of entropy). */
export function generateBackupCode(): string {
  const chars = Array.from({ length: 10 }, () => BACKUP_ALPHABET[randomInt(0, BACKUP_ALPHABET.length)]);
  return `${chars.slice(0, 5).join('')}-${chars.slice(5).join('')}`;
}

export function normalizeBackupCode(input: string): string {
  const compact = input.replace(/[\s-]/g, '').toUpperCase();
  return compact.length === 10 ? `${compact.slice(0, 5)}-${compact.slice(5)}` : compact;
}

/** AES-256-GCM. Output format: `v1.<iv>.<tag>.<ciphertext>` (all base64url). */
export function encryptAes256Gcm(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptAes256Gcm(payload: string, key: Buffer): string {
  const [version, iv, tag, ciphertext] = payload.split('.');
  if (version !== 'v1' || !iv || !tag || !ciphertext) throw new Error('Unsupported ciphertext format');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64url')), decipher.final()]).toString('utf8');
}

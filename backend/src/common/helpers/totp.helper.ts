import { createHmac, randomBytes } from 'node:crypto';
import { safeEqual } from './crypto.helper.js';

/**
 * RFC 4226 (HOTP) / RFC 6238 (TOTP) implemented with node:crypto only.
 * Authenticator apps (Google Authenticator, Authy, 1Password...) use SHA-1 / 6 digits / 30 s.
 */

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(input: string): Buffer {
  const clean = input.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = BASE32.indexOf(char);
    if (index === -1) throw new Error('Invalid base32 character');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160-bit secret, base32 encoded (what the QR code / manual entry carries). */
export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

export function hotp(secret: Buffer, counter: number, digits = 6): string {
  const message = Buffer.alloc(8);
  message.writeBigUInt64BE(BigInt(counter));
  const hash = createHmac('sha1', secret).update(message).digest();
  const offset = hash[hash.length - 1]! & 0x0f;
  const binary =
    ((hash[offset]! & 0x7f) << 24) | (hash[offset + 1]! << 16) | (hash[offset + 2]! << 8) | hash[offset + 3]!;
  return (binary % 10 ** digits).toString().padStart(digits, '0');
}

export const TOTP_PERIOD_SECONDS = 30;

export const totpCounter = (timeMs: number = Date.now()): number => Math.floor(timeMs / 1000 / TOTP_PERIOD_SECONDS);

export const computeTotp = (secretBase32: string, timeMs: number = Date.now(), digits = 6): string =>
  hotp(base32Decode(secretBase32), totpCounter(timeMs), digits);

/**
 * Verifies a code allowing +/- `window` time steps of clock drift.
 * Returns the matched counter (so callers can reject replays) or null.
 */
export function verifyTotp(
  secretBase32: string,
  token: string,
  options: { window?: number; timeMs?: number } = {},
): number | null {
  if (!/^\d{6}$/.test(token)) return null;
  const { window = 1, timeMs = Date.now() } = options;
  const secret = base32Decode(secretBase32);
  const current = totpCounter(timeMs);
  let matched: number | null = null;
  // Evaluate every step (no early exit) to keep timing independent of which step matched.
  for (let step = -window; step <= window; step++) {
    if (safeEqual(hotp(secret, current + step), token) && matched === null) matched = current + step;
  }
  return matched;
}

export function buildOtpauthUrl(params: { secret: string; accountName: string; issuer: string }): string {
  const label = `${encodeURIComponent(params.issuer)}:${encodeURIComponent(params.accountName)}`;
  const query = new URLSearchParams({
    secret: params.secret,
    issuer: params.issuer,
    algorithm: 'SHA1',
    digits: '6',
    period: String(TOTP_PERIOD_SECONDS),
  });
  return `otpauth://totp/${label}?${query.toString()}`;
}

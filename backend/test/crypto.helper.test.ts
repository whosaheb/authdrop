import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { describe, it } from 'node:test';
import {
  decryptAes256Gcm,
  encryptAes256Gcm,
  generateBackupCode,
  hmacSha256Hex,
  normalizeBackupCode,
  randomNumericCode,
  randomToken,
  safeEqual,
} from '../src/common/helpers/crypto.helper.js';
import { isSafeRelativePath } from '../src/common/helpers/request.helper.js';

describe('crypto.helper', () => {
  const key = randomBytes(32);

  it('encrypts and decrypts (AES-256-GCM) with unique IVs', () => {
    const a = encryptAes256Gcm('JBSWY3DPEHPK3PXP', key);
    const b = encryptAes256Gcm('JBSWY3DPEHPK3PXP', key);
    assert.notEqual(a, b);
    assert.equal(decryptAes256Gcm(a, key), 'JBSWY3DPEHPK3PXP');
  });

  it('detects tampering and wrong keys', () => {
    const encrypted = encryptAes256Gcm('secret', key);
    const parts = encrypted.split('.');
    parts[3] = Buffer.from('tampered').toString('base64url');
    assert.throws(() => decryptAes256Gcm(parts.join('.'), key));
    assert.throws(() => decryptAes256Gcm(encrypted, randomBytes(32)));
  });

  it('produces zero-padded numeric codes of the requested length', () => {
    for (let i = 0; i < 200; i++) assert.match(randomNumericCode(6), /^\d{6}$/);
  });

  it('produces high-entropy URL-safe tokens', () => {
    const tokens = new Set(Array.from({ length: 100 }, () => randomToken()));
    assert.equal(tokens.size, 100);
    for (const t of tokens) assert.match(t, /^[A-Za-z0-9_-]{43}$/);
  });

  it('compares strings safely', () => {
    assert.equal(safeEqual('abc', 'abc'), true);
    assert.equal(safeEqual('abc', 'abd'), false);
    assert.equal(safeEqual('abc', 'abcd'), false);
  });

  it('generates and normalises backup codes', () => {
    const code = generateBackupCode();
    assert.match(code, /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);
    assert.equal(normalizeBackupCode(code.toLowerCase().replace('-', ' ')), code);
  });

  it('hmac depends on the key', () => {
    assert.notEqual(hmacSha256Hex('x', 'k1'), hmacSha256Hex('x', 'k2'));
  });

  it('only allows same-origin relative redirect targets', () => {
    assert.equal(isSafeRelativePath('/account/settings'), true);
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', undefined]) {
      assert.equal(isSafeRelativePath(bad as string | undefined), false);
    }
  });
});

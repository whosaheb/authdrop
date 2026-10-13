import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  base32Decode,
  base32Encode,
  buildOtpauthUrl,
  computeTotp,
  generateTotpSecret,
  hotp,
  totpCounter,
  verifyTotp,
} from '../src/common/helpers/totp.helper.js';

// RFC 6238 Appendix B uses the ASCII secret "12345678901234567890" (SHA-1).
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp.helper', () => {
  it('matches RFC 4226 HOTP test vectors', () => {
    const secret = Buffer.from('12345678901234567890');
    const expected = ['755224', '287082', '359152', '969429', '338314', '254676', '287922', '162583', '399871', '520489'];
    expected.forEach((code, counter) => assert.equal(hotp(secret, counter), code));
  });

  it('matches RFC 6238 TOTP test vectors (6-digit truncation)', () => {
    // 8-digit vectors from the RFC: 94287082, 07081804, 14050471 -> last six digits
    assert.equal(computeTotp(RFC_SECRET, 59_000), '287082');
    assert.equal(computeTotp(RFC_SECRET, 1_111_111_109_000), '081804');
    assert.equal(computeTotp(RFC_SECRET, 1_111_111_111_000), '050471');
  });

  it('round-trips base32', () => {
    for (let i = 0; i < 50; i++) {
      const raw = Buffer.from(Array.from({ length: 20 }, () => Math.floor(Math.random() * 256)));
      assert.deepEqual(base32Decode(base32Encode(raw)), raw);
    }
  });

  it('accepts the current code and +/- one step, rejects further drift', () => {
    const now = 1_700_000_000_000;
    const code = (offsetSteps: number) => computeTotp(RFC_SECRET, now + offsetSteps * 30_000);
    assert.equal(verifyTotp(RFC_SECRET, code(0), { timeMs: now }), totpCounter(now));
    assert.equal(verifyTotp(RFC_SECRET, code(-1), { timeMs: now }), totpCounter(now) - 1);
    assert.equal(verifyTotp(RFC_SECRET, code(1), { timeMs: now }), totpCounter(now) + 1);
    assert.equal(verifyTotp(RFC_SECRET, code(3), { timeMs: now }), null);
  });

  it('rejects malformed tokens', () => {
    for (const bad of ['', '12345', '1234567', 'abcdef', '12 456']) {
      assert.equal(verifyTotp(RFC_SECRET, bad), null);
    }
  });

  it('generates 160-bit secrets and valid otpauth URLs', () => {
    const secret = generateTotpSecret();
    assert.equal(base32Decode(secret).length, 20);
    const url = buildOtpauthUrl({ secret, accountName: 'a@b.com', issuer: 'AuthDrop' });
    assert.match(url, /^otpauth:\/\/totp\/AuthDrop:a%40b\.com\?/);
    assert.match(url, /secret=/);
  });
});

import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { TooManyRequestsException } from '../../common/exceptions/too-many-requests.exception.js';
import { randomNumericCode, safeEqual } from '../../common/helpers/crypto.helper.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';

export type OtpVerification = 'valid' | 'invalid' | 'locked';

const otpKey = (fingerprint: string) => `otp:${fingerprint}`;
const cooldownKey = (fingerprint: string) => `otp:cd:${fingerprint}`;

/**
 * Email one-time codes (the passwordless core).
 *
 * - 6 digits from a CSPRNG, stored only as an HMAC (keyed with the pepper) - never in plaintext.
 * - Single use, short TTL, atomic attempt counter (HINCRBY) so parallel guesses cannot exceed the limit.
 * - Per-address resend cooldown. Keys use a hash of the address, so e-mails never appear in Redis.
 */
@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly config: AppConfig,
  ) {}

  /** Creates a fresh code (invalidating any previous one) and returns it for delivery. */
  async issue(email: string): Promise<string> {
    const fingerprint = this.crypto.fingerprint(email);
    const { resendCooldownSeconds, ttlSeconds } = this.config.otp;

    if (resendCooldownSeconds > 0) {
      const acquired = await this.redis.client.set(cooldownKey(fingerprint), '1', 'EX', resendCooldownSeconds, 'NX');
      if (acquired === null) {
        const ttl = await this.redis.client.ttl(cooldownKey(fingerprint));
        throw new TooManyRequestsException(Math.max(ttl, 1), 'Please wait before requesting another code.');
      }
    }

    const code = randomNumericCode(6);
    const key = otpKey(fingerprint);
    await this.redis.client.multi().del(key).hset(key, { hash: this.hash(email, code), attempts: 0 }).expire(key, ttlSeconds).exec();
    return code;
  }

  async verify(email: string, code: string): Promise<OtpVerification> {
    const key = otpKey(this.crypto.fingerprint(email));
    // Count the attempt BEFORE comparing, atomically; this makes brute force bounded even under concurrency.
    const attempts = await this.redis.client.hincrby(key, 'attempts', 1);
    const storedHash = await this.redis.client.hget(key, 'hash');
    if (!storedHash) {
      await this.redis.del(key);
      return 'invalid';
    }
    if (attempts > this.config.otp.maxAttempts) {
      await this.redis.del(key);
      return 'locked';
    }
    if (!safeEqual(storedHash, this.hash(email, code))) return 'invalid';
    await this.redis.del(key);
    return 'valid';
  }

  private hash(email: string, code: string): string {
    return this.crypto.hmac(`otp:${email}:${code}`);
  }
}

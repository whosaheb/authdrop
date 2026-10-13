import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'authdrop:rateLimit';

export interface RateLimitOptions {
  /** Logical bucket name, e.g. "otp-request". */
  name: string;
  /** Max requests per window. */
  limit: number;
  windowSeconds: number;
  /** What identifies the caller. "email" reads `body.email`. Multiple keys are checked independently. */
  by: Array<'ip' | 'email' | 'user'>;
}

/** Redis-backed fixed-window limiter (works across multiple instances). */
export const RateLimit = (...options: RateLimitOptions[]): MethodDecorator & ClassDecorator =>
  SetMetadata(RATE_LIMIT_KEY, options);

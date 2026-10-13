import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import { RATE_LIMIT_KEY, type RateLimitOptions } from '../decorators/rate-limit.decorator.js';
import { TooManyRequestsException } from '../exceptions/too-many-requests.exception.js';
import { normalizeEmail } from '../helpers/email.helper.js';
import { sha256Hex } from '../helpers/crypto.helper.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';

/** Applies @RateLimit() buckets. Each identifier in `by` is counted independently; any breach blocks. */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly redis: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const buckets = this.reflector.getAllAndOverride<RateLimitOptions[] | undefined>(RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!buckets || buckets.length === 0) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    let worst = 0;

    for (const options of buckets) {
      for (const dimension of options.by) {
        const identity = this.identify(dimension, request);
        if (!identity) continue;
        const key = `rl:${options.name}:${dimension}:${sha256Hex(identity)}`;
        const { count, ttl } = await this.redis.incrementWindow(key, options.windowSeconds);
        if (count > options.limit) worst = Math.max(worst, ttl);
      }
    }

    if (worst > 0) throw new TooManyRequestsException(worst);
    return true;
  }

  private identify(dimension: 'ip' | 'email' | 'user', request: FastifyRequest): string | null {
    switch (dimension) {
      case 'ip':
        return request.ip;
      case 'user':
        return request.authUser?.id ?? null;
      case 'email': {
        const email = (request.body as { email?: unknown } | undefined)?.email;
        return typeof email === 'string' && email.length > 0 ? normalizeEmail(email) : null;
      }
    }
  }
}

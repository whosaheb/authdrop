import { type CanActivate, type ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import { AppConfig } from '../../config/app-config.service.js';
import { CSRF_HEADER } from '../constants/cookies.js';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for the cookie-authenticated API (defence in depth on top of SameSite=Lax):
 *  1. If an Origin header is present it must be our own origin.
 *  2. State-changing requests must carry a custom header, which browsers will not attach to
 *     cross-site form posts and which cannot be added cross-origin without a (denied) CORS preflight.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(
    private readonly config: AppConfig,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [context.getHandler(), context.getClass()])) return true;

    const request = context.switchToHttp().getRequest<FastifyRequest>();
    if (SAFE_METHODS.has(request.method)) return true;

    const origin = request.headers.origin;
    if (origin && origin !== this.config.appUrl) throw new ForbiddenException('Cross-origin request blocked');
    if (request.headers[CSRF_HEADER] !== '1') throw new ForbiddenException('Missing CSRF protection header');
    return true;
  }
}

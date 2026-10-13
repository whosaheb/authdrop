import { type CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { type FastifyRequest } from 'fastify';
import { SESSION_COOKIE } from '../constants/cookies.js';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import { SessionService } from '../../modules/auth-core/session.service.js';
import { UsersService } from '../../modules/users/users.service.js';

/**
 * Global, default-deny authentication guard.
 * Every route requires a valid portal session unless it is explicitly marked @Public().
 * On public routes a valid session is still resolved (when present) so handlers can use it.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly users: UsersService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest<FastifyRequest>();

    const sessionId = request.cookies?.[SESSION_COOKIE];
    const session = sessionId ? await this.sessions.get(sessionId) : null;
    const user = session ? await this.users.findActiveById(session.userId) : null;

    if (session && user && sessionId) {
      await this.sessions.touch(sessionId, session);
      request.authUser = {
        id: user.id,
        email: user.email,
        role: user.role,
        sessionId,
        sessionRef: this.sessions.refFor(sessionId),
      };
      return true;
    }

    if (session && sessionId && !user) await this.sessions.destroy(sessionId); // suspended or deleted account
    if (isPublic) return true;
    throw new UnauthorizedException('Authentication required');
  }
}

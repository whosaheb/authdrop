import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type FastifyRequest } from 'fastify';
import { type AuthenticatedUser } from '../interfaces/authenticated-user.interface.js';

/** Injects the user resolved by SessionGuard. Only valid on non-@Public routes. */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
  const request = ctx.switchToHttp().getRequest<FastifyRequest>();
  return request.authUser as AuthenticatedUser;
});

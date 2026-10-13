import 'fastify';
import { type AuthenticatedUser } from '../common/interfaces/authenticated-user.interface.js';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by SessionGuard on authenticated routes. */
    authUser?: AuthenticatedUser;
  }
}

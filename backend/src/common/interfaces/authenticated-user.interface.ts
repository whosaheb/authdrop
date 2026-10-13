import { type UserRole } from '../../generated/prisma/client.js';

/** What SessionGuard attaches to `request.authUser`. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  /** Opaque portal session id (never expose to clients; use `sessionRef`). */
  sessionId: string;
  /** Public, non-reversible handle for the current session. */
  sessionRef: string;
}

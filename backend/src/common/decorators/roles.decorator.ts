import { SetMetadata } from '@nestjs/common';
import { type UserRole } from '../../generated/prisma/client.js';

export const ROLES_KEY = 'authdrop:roles';

/** Restricts a route to users holding any of the given roles. */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator => SetMetadata(ROLES_KEY, roles);

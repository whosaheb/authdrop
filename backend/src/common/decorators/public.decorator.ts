import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'authdrop:isPublic';

/** Opt-out of the global default-deny SessionGuard. Use sparingly and only on pre-auth endpoints. */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);

import { SetMetadata } from '@nestjs/common';

export const SKIP_CSRF_KEY = 'authdrop:skipCsrf';

/**
 * Exempts a controller from the custom-header CSRF check.
 * Only for protocol endpoints with their own protection (oidc-provider: client auth, PKCE, xsrf tokens).
 */
export const SkipCsrf = (): MethodDecorator & ClassDecorator => SetMetadata(SKIP_CSRF_KEY, true);

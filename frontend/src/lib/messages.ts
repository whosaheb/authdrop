import { isApiError } from '../api/client';

/** Friendly text for any thrown value. Never reveals whether an email exists. */
export function errorMessage(e: unknown, fallback = 'Something went wrong. Try again.'): string {
  if (isApiError(e)) {
    if (e.status === 0) return e.message;
    if (e.status === 429) return e.retryAfterSeconds ? `Too many attempts. Try again in ${e.retryAfterSeconds} seconds.` : 'Too many attempts. Wait a moment and try again.';
    if (e.status >= 500) return `The server had a problem.${e.requestId ? ` Reference: ${e.requestId}` : ''}`;
    return e.message || fallback;
  }
  return fallback;
}

/** Messages for ?error= values set by the social callback (social-auth.controller.ts) and the auth service. */
const LOGIN_ERRORS: Record<string, string> = {
  social_denied: 'Sign-in with that provider was cancelled. You can try again or use an email code.',
  social_unverified: 'That provider did not share a verified email address, so we could not sign you in with it. Use an email code instead.',
  social_failed: 'We could not complete sign-in with that provider. Try again or use an email code.',
  account_unavailable: 'This account cannot sign in right now. Contact support if you think this is a mistake.',
};

export function loginErrorMessage(code: string | null): string | null {
  if (!code) return null;
  return LOGIN_ERRORS[code] ?? 'We could not sign you in. Try again.';
}

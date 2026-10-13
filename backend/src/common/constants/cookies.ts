/** Portal SSO session (Redis-backed, opaque id). Name is fixed by the SRS. */
export const SESSION_COOKIE = 'authdrop_session';
/** Short-lived ticket between "email proven" and "login finished" (MFA / profile steps). */
export const PREAUTH_COOKIE = 'authdrop_preauth';
/** Binds a social-login `state` to the browser that started it (login CSRF protection). */
export const OAUTH_STATE_COOKIE = 'authdrop_oauth_state';

/** Custom header every state-changing API call must carry (blocks cross-site form posts). */
export const CSRF_HEADER = 'x-authdrop-csrf';

/** Binds an OIDC interaction uid to the browser that started /authorize (set by oidc-provider's interactions.url). */
export const INTERACTION_COOKIE = 'authdrop_interaction';

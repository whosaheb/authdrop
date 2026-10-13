/** Nest DI token for the singleton oidc-provider instance. */
export const OIDC_PROVIDER = Symbol('OIDC_PROVIDER');

/** Mount point of the protocol endpoints (issuer = {APP_URL}/oauth). */
export const OIDC_MOUNT_PATH = '/oauth';

/** Scopes AuthDrop supports; anything else requested by a client is ignored when auto-granting. */
export const SUPPORTED_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;

export const OIDC_ROUTES = {
  authorization: '/authorize',
  token: '/token',
  userinfo: '/userinfo',
  jwks: '/.well-known/jwks.json',
  revocation: '/revoke',
  introspection: '/introspect',
  end_session: '/logout',
} as const;

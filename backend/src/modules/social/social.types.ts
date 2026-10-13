export const SOCIAL_PROVIDER_IDS = ['google', 'github', 'facebook', 'linkedin'] as const;
export type SocialProviderId = (typeof SOCIAL_PROVIDER_IDS)[number];

export const isSocialProviderId = (value: string): value is SocialProviderId =>
  (SOCIAL_PROVIDER_IDS as readonly string[]).includes(value);

/**
 * What every upstream provider is reduced to. Upstream tokens are discarded right after this is built:
 * AuthDrop only uses social login as one more way to prove ownership of a verified e-mail address.
 */
export interface SocialIdentity {
  provider: SocialProviderId;
  providerUserId: string;
  email: string;
  /** Must be true or the login is rejected (prevents account takeover through unverified e-mails). */
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
  pictureUrl?: string;
}

export interface SocialAuthRequest {
  state: string;
  nonce: string;
  codeChallenge: string;
  redirectUri: string;
}

export interface SocialCodeExchange {
  code: string;
  codeVerifier: string;
  nonce: string;
  redirectUri: string;
}

/** Contract every provider adapter implements. Adding a provider = one class + one registry entry. */
export interface SocialProvider {
  readonly id: SocialProviderId;
  readonly displayName: string;
  isEnabled(): boolean;
  buildAuthorizationUrl(request: SocialAuthRequest): string;
  exchangeCodeForIdentity(exchange: SocialCodeExchange): Promise<SocialIdentity>;
}

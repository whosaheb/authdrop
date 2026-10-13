import { createRemoteJWKSet, jwtVerify } from 'jose';
import { SocialAuthError } from '../social.errors.js';
import { type SocialCodeExchange, type SocialIdentity } from '../social.types.js';
import { BaseOAuthProvider } from './base-oauth.provider.js';
import { fetchJson, formBody } from './http.helper.js';

interface IdTokenClaims {
  sub: string;
  email?: string;
  email_verified?: boolean | string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  nonce?: string;
}

/**
 * Providers that are real OpenID Connect IdPs (Google, LinkedIn): the ID token is verified
 * (signature via the provider JWKS, issuer, audience, expiry and nonce) before anything is trusted.
 */
export abstract class OidcSocialProvider extends BaseOAuthProvider {
  protected abstract readonly tokenEndpoint: string;
  protected abstract readonly jwksUri: string;
  protected abstract readonly issuers: string[];

  private jwks?: ReturnType<typeof createRemoteJWKSet>;

  protected override get usesNonce(): boolean {
    return true;
  }

  async exchangeCodeForIdentity(exchange: SocialCodeExchange): Promise<SocialIdentity> {
    const token = await fetchJson<{ id_token?: string }>(this.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody(this.tokenRequestFields(exchange)),
    });
    if (!token.id_token) throw new SocialAuthError(`${this.id}: token response has no id_token`);

    this.jwks ??= createRemoteJWKSet(new URL(this.jwksUri), { timeoutDuration: 10_000, cooldownDuration: 30_000 });
    let claims: IdTokenClaims;
    try {
      const { payload } = await jwtVerify(token.id_token, this.jwks, { issuer: this.issuers, audience: this.clientId, algorithms: ['RS256'] });
      claims = payload as unknown as IdTokenClaims;
    } catch (error) {
      throw new SocialAuthError(`${this.id}: id_token validation failed: ${(error as Error).message}`);
    }

    if (claims.nonce !== exchange.nonce) throw new SocialAuthError(`${this.id}: nonce mismatch`, 'invalid_state');
    if (!claims.email) throw new SocialAuthError(`${this.id}: no email in id_token`, 'unverified_email');

    return {
      provider: this.id,
      providerUserId: claims.sub,
      email: claims.email.toLowerCase(),
      emailVerified: claims.email_verified === true || claims.email_verified === 'true',
      firstName: claims.given_name,
      lastName: claims.family_name,
      pictureUrl: claims.picture,
    };
  }
}

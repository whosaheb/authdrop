import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service.js';
import { SocialAuthError } from '../social.errors.js';
import { type SocialCodeExchange, type SocialIdentity } from '../social.types.js';
import { BaseOAuthProvider } from './base-oauth.provider.js';
import { fetchJson } from './http.helper.js';

interface FacebookMe { id: string; email?: string; first_name?: string; last_name?: string; picture?: { data?: { url?: string } } }

/**
 * Facebook Login. Facebook only returns addresses the user has confirmed, so a returned `email` counts
 * as verified; an account without one (phone-only sign-ups) is rejected.
 */
@Injectable()
export class FacebookProvider extends BaseOAuthProvider {
  readonly id = 'facebook' as const;
  readonly displayName = 'Facebook';
  protected readonly scopes = ['email', 'public_profile'];
  protected override readonly usePkce = false;

  constructor(config: AppConfig) {
    super(config);
  }

  protected get authorizationEndpoint(): string {
    return `https://www.facebook.com/${this.config.facebookGraphVersion}/dialog/oauth`;
  }

  // Facebook expects comma-separated scopes.
  override buildAuthorizationUrl(...args: Parameters<BaseOAuthProvider['buildAuthorizationUrl']>): string {
    const url = new URL(super.buildAuthorizationUrl(...args));
    url.searchParams.set('scope', this.scopes.join(','));
    return url.toString();
  }

  async exchangeCodeForIdentity(exchange: SocialCodeExchange): Promise<SocialIdentity> {
    const graph = `https://graph.facebook.com/${this.config.facebookGraphVersion}`;
    const tokenUrl = new URL(`${graph}/oauth/access_token`);
    for (const [k, v] of Object.entries(this.tokenRequestFields(exchange))) tokenUrl.searchParams.set(k, v);
    const token = await fetchJson<{ access_token?: string }>(tokenUrl.toString());
    if (!token.access_token) throw new SocialAuthError('facebook: token exchange failed');

    const meUrl = new URL(`${graph}/me`);
    meUrl.searchParams.set('fields', 'id,first_name,last_name,email,picture.type(large)');
    const me = await fetchJson<FacebookMe>(meUrl.toString(), { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!me.email) throw new SocialAuthError('facebook: account has no e-mail', 'unverified_email');

    return {
      provider: 'facebook',
      providerUserId: me.id,
      email: me.email.toLowerCase(),
      emailVerified: true,
      firstName: me.first_name,
      lastName: me.last_name,
      pictureUrl: me.picture?.data?.url,
    };
  }
}

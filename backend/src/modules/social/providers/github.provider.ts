import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service.js';
import { SocialAuthError } from '../social.errors.js';
import { type SocialCodeExchange, type SocialIdentity } from '../social.types.js';
import { BaseOAuthProvider } from './base-oauth.provider.js';
import { fetchJson, formBody } from './http.helper.js';

interface GithubUser { id: number; name: string | null; login: string; avatar_url?: string }
interface GithubEmail { email: string; primary: boolean; verified: boolean }

/** GitHub is plain OAuth 2.0: only a *primary + verified* address is accepted as proof of e-mail ownership. */
@Injectable()
export class GitHubProvider extends BaseOAuthProvider {
  readonly id = 'github' as const;
  readonly displayName = 'GitHub';
  protected readonly authorizationEndpoint = 'https://github.com/login/oauth/authorize';
  protected readonly scopes = ['read:user', 'user:email'];

  constructor(config: AppConfig) {
    super(config);
  }

  async exchangeCodeForIdentity(exchange: SocialCodeExchange): Promise<SocialIdentity> {
    const token = await fetchJson<{ access_token?: string; error?: string }>('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody(this.tokenRequestFields(exchange)),
    });
    if (!token.access_token) throw new SocialAuthError(`github: token exchange failed (${token.error ?? 'unknown'})`);

    const headers = { Authorization: `Bearer ${token.access_token}`, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'AuthDrop-IdP' };
    const [user, emails] = await Promise.all([
      fetchJson<GithubUser>('https://api.github.com/user', { headers }),
      fetchJson<GithubEmail[]>('https://api.github.com/user/emails', { headers }),
    ]);

    const primary = emails.find((e) => e.primary && e.verified);
    if (!primary) throw new SocialAuthError('github: no verified primary e-mail', 'unverified_email');

    const [firstName, ...rest] = (user.name ?? user.login).trim().split(/\s+/);
    return {
      provider: 'github',
      providerUserId: String(user.id),
      email: primary.email.toLowerCase(),
      emailVerified: true,
      firstName,
      lastName: rest.join(' ') || undefined,
      pictureUrl: user.avatar_url,
    };
  }
}

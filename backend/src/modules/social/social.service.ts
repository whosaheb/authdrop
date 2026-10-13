import { createHash } from 'node:crypto';
import { Injectable, NotFoundException } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { randomToken, safeEqual, sha256Hex } from '../../common/helpers/crypto.helper.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { FacebookProvider } from './providers/facebook.provider.js';
import { GitHubProvider } from './providers/github.provider.js';
import { GoogleProvider } from './providers/google.provider.js';
import { LinkedInProvider } from './providers/linkedin.provider.js';
import { SocialAuthError } from './social.errors.js';
import { isSocialProviderId, type SocialIdentity, type SocialProvider, type SocialProviderId } from './social.types.js';

interface PendingSocialLogin {
  provider: SocialProviderId;
  codeVerifier: string;
  nonce: string;
  uid?: string;
}

const STATE_TTL_SECONDS = 600;
const stateKey = (state: string) => `social:state:${sha256Hex(state)}`;

/**
 * Runs the OAuth dance with an upstream provider and returns a verified identity.
 * It knows nothing about AuthDrop sessions: the auth module decides what the identity means.
 *
 * Login-CSRF protection: `state` is random, stored server-side (single use) AND mirrored into an
 * HttpOnly cookie, so a callback only works in the browser that started the flow.
 */
@Injectable()
export class SocialService {
  private readonly providers: ReadonlyMap<SocialProviderId, SocialProvider>;

  constructor(
    private readonly config: AppConfig,
    private readonly redis: RedisService,
    google: GoogleProvider,
    github: GitHubProvider,
    facebook: FacebookProvider,
    linkedin: LinkedInProvider,
  ) {
    this.providers = new Map<SocialProviderId, SocialProvider>([google, github, facebook, linkedin].map((p) => [p.id, p]));
  }

  listEnabled(): Array<{ id: SocialProviderId; name: string }> {
    return [...this.providers.values()].filter((p) => p.isEnabled()).map((p) => ({ id: p.id, name: p.displayName }));
  }

  private resolve(id: string): SocialProvider {
    if (!isSocialProviderId(id)) throw new NotFoundException('Unknown provider');
    const provider = this.providers.get(id);
    if (!provider?.isEnabled()) throw new NotFoundException('This sign-in method is not available');
    return provider;
  }

  private callbackUrl(id: SocialProviderId): string {
    return `${this.config.appUrl}/api/auth/social/${id}/callback`;
  }

  async begin(providerId: string, uid?: string): Promise<{ redirectUrl: string; state: string }> {
    const provider = this.resolve(providerId);
    const state = randomToken(32);
    const nonce = randomToken(16);
    const codeVerifier = randomToken(48);
    const codeChallenge = createHash('sha256').update(codeVerifier).digest('base64url');

    const pending: PendingSocialLogin = { provider: provider.id, codeVerifier, nonce, uid };
    await this.redis.setJson(stateKey(state), pending, STATE_TTL_SECONDS);

    const redirectUrl = provider.buildAuthorizationUrl({ state, nonce, codeChallenge, redirectUri: this.callbackUrl(provider.id) });
    return { redirectUrl, state };
  }

  async complete(providerId: string, params: { code: string; state: string; cookieState: string | undefined }): Promise<{ identity: SocialIdentity; uid?: string }> {
    const provider = this.resolve(providerId);
    if (!params.cookieState || !safeEqual(params.cookieState, params.state)) {
      throw new SocialAuthError('state cookie missing or mismatching', 'invalid_state');
    }
    const pending = await this.redis.getDelJson<PendingSocialLogin>(stateKey(params.state));
    if (!pending || pending.provider !== provider.id) throw new SocialAuthError('unknown or expired state', 'invalid_state');

    const identity = await provider.exchangeCodeForIdentity({
      code: params.code,
      codeVerifier: pending.codeVerifier,
      nonce: pending.nonce,
      redirectUri: this.callbackUrl(provider.id),
    });
    if (!identity.emailVerified) throw new SocialAuthError(`${provider.id}: e-mail not verified`, 'unverified_email');
    return { identity, uid: pending.uid };
  }
}

import { type AppConfig } from '../../../config/app-config.service.js';
import {
  type SocialAuthRequest,
  type SocialCodeExchange,
  type SocialIdentity,
  type SocialProvider,
  type SocialProviderId,
} from '../social.types.js';

/** Shared plumbing: credentials lookup, enabled flag and authorization URL construction. */
export abstract class BaseOAuthProvider implements SocialProvider {
  abstract readonly id: SocialProviderId;
  abstract readonly displayName: string;
  protected abstract readonly authorizationEndpoint: string;
  protected abstract readonly scopes: string[];
  /** Providers that do not (reliably) support PKCE rely on `state` + `nonce` + the confidential client secret. */
  protected readonly usePkce: boolean = true;
  protected readonly extraAuthParams: Record<string, string> = {};

  constructor(protected readonly config: AppConfig) {}

  protected get credentials() {
    return this.config.socialCredentials(this.id);
  }

  isEnabled(): boolean {
    return this.credentials !== null;
  }

  protected get clientId(): string {
    return this.credentials!.clientId;
  }

  protected get clientSecret(): string {
    return this.credentials!.clientSecret;
  }

  buildAuthorizationUrl(request: SocialAuthRequest): string {
    const url = new URL(this.authorizationEndpoint);
    const params: Record<string, string> = {
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: request.redirectUri,
      scope: this.scopes.join(' '),
      state: request.state,
      ...this.extraAuthParams,
    };
    if (this.usePkce) {
      params.code_challenge = request.codeChallenge;
      params.code_challenge_method = 'S256';
    }
    if (this.usesNonce) params.nonce = request.nonce;
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  }

  protected get usesNonce(): boolean {
    return false;
  }

  abstract exchangeCodeForIdentity(exchange: SocialCodeExchange): Promise<SocialIdentity>;

  protected tokenRequestFields(exchange: SocialCodeExchange): Record<string, string> {
    return {
      grant_type: 'authorization_code',
      code: exchange.code,
      redirect_uri: exchange.redirectUri,
      client_id: this.clientId,
      client_secret: this.clientSecret,
      ...(this.usePkce ? { code_verifier: exchange.codeVerifier } : {}),
    };
  }
}

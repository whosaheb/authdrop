import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service.js';
import { OidcSocialProvider } from './oidc-social.provider.js';

/** "Sign In with LinkedIn using OpenID Connect". Confidential client: secret + nonce + state (PKCE not offered). */
@Injectable()
export class LinkedInProvider extends OidcSocialProvider {
  readonly id = 'linkedin' as const;
  readonly displayName = 'LinkedIn';
  protected readonly authorizationEndpoint = 'https://www.linkedin.com/oauth/v2/authorization';
  protected readonly tokenEndpoint = 'https://www.linkedin.com/oauth/v2/accessToken';
  protected readonly jwksUri = 'https://www.linkedin.com/oauth/openid/jwks';
  protected readonly issuers = ['https://www.linkedin.com/oauth'];
  protected readonly scopes = ['openid', 'profile', 'email'];
  protected override readonly usePkce = false;

  constructor(config: AppConfig) {
    super(config);
  }
}

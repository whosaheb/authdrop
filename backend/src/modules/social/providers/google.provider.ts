import { Injectable } from '@nestjs/common';
import { AppConfig } from '../../../config/app-config.service.js';
import { OidcSocialProvider } from './oidc-social.provider.js';

@Injectable()
export class GoogleProvider extends OidcSocialProvider {
  readonly id = 'google' as const;
  readonly displayName = 'Google';
  protected readonly authorizationEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
  protected readonly tokenEndpoint = 'https://oauth2.googleapis.com/token';
  protected readonly jwksUri = 'https://www.googleapis.com/oauth2/v3/certs';
  protected readonly issuers = ['https://accounts.google.com', 'accounts.google.com'];
  protected readonly scopes = ['openid', 'email', 'profile'];
  // `select_account` lets users pick the right Google identity instead of silently reusing one.
  protected override readonly extraAuthParams = { prompt: 'select_account' };

  constructor(config: AppConfig) {
    super(config);
  }
}

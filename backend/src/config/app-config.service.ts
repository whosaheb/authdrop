import { Injectable } from '@nestjs/common';
import { type EnvironmentVariables, validateEnv } from './env.validation.js';
import { type SocialProviderId } from '../modules/social/social.types.js';

export interface SocialProviderCredentials {
  clientId: string;
  clientSecret: string;
}

/**
 * Typed, validated, immutable view of the process environment.
 * Injected everywhere instead of reading process.env directly.
 */
@Injectable()
export class AppConfig {
  private readonly env: EnvironmentVariables;

  constructor() {
    this.env = validateEnv(process.env);
  }

  get nodeEnv(): string { return this.env.NODE_ENV; }
  get isProduction(): boolean { return this.env.NODE_ENV === 'production'; }
  get port(): number { return this.env.PORT; }
  get host(): string { return this.env.HOST; }
  get trustProxy(): boolean { return this.env.TRUST_PROXY; }

  /** Public origin, e.g. https://authdrop.example.com (no trailing slash). */
  get appUrl(): string { return new URL(this.env.APP_URL).origin; }
  /** OIDC issuer identifier. Discovery lives at {issuer}/.well-known/openid-configuration. */
  get issuer(): string { return `${this.appUrl}/oauth`; }
  get secureCookies(): boolean { return this.appUrl.startsWith('https://'); }

  get databaseUrl(): string { return this.env.DATABASE_URL; }
  get redisUrl(): string { return this.env.REDIS_URL; }

  get encryptionKey(): Buffer { return Buffer.from(this.env.ENCRYPTION_KEY, 'base64'); }
  get hmacPepper(): string { return this.env.HMAC_PEPPER; }

  get oidc() {
    return {
      cookieKeys: this.env.OIDC_COOKIE_KEYS.split(',').map((k) => k.trim()),
      jwks: this.env.OIDC_JWKS,
      jwksPath: this.env.OIDC_JWKS_PATH,
      requirePkce: this.env.OIDC_REQUIRE_PKCE,
    };
  }

  get session() {
    return {
      idleTtlSeconds: this.env.SESSION_IDLE_TTL_SECONDS,
      absoluteTtlSeconds: this.env.SESSION_ABSOLUTE_TTL_SECONDS,
    };
  }

  get otp() {
    return {
      ttlSeconds: this.env.OTP_TTL_SECONDS,
      maxAttempts: this.env.OTP_MAX_ATTEMPTS,
      resendCooldownSeconds: this.env.OTP_RESEND_COOLDOWN_SECONDS,
    };
  }

  get mail() {
    return {
      host: this.env.SMTP_HOST,
      port: this.env.SMTP_PORT,
      secure: this.env.SMTP_SECURE,
      user: this.env.SMTP_USER,
      pass: this.env.SMTP_PASS,
      from: this.env.MAIL_FROM,
    };
  }

  /** Null when R2 is not configured; the storage service then rejects uploads with 503. */
  get storage() {
    const e = this.env;
    if (!e.R2_ACCOUNT_ID || !e.R2_ACCESS_KEY_ID || !e.R2_SECRET_ACCESS_KEY || !e.R2_BUCKET || !e.R2_PUBLIC_BASE_URL) {
      return null;
    }
    return {
      accountId: e.R2_ACCOUNT_ID,
      accessKeyId: e.R2_ACCESS_KEY_ID,
      secretAccessKey: e.R2_SECRET_ACCESS_KEY,
      bucket: e.R2_BUCKET,
      publicBaseUrl: e.R2_PUBLIC_BASE_URL.replace(/\/+$/, ''),
    };
  }

  socialCredentials(provider: SocialProviderId): SocialProviderCredentials | null {
    const e = this.env;
    const map: Record<SocialProviderId, [string | undefined, string | undefined]> = {
      google: [e.GOOGLE_CLIENT_ID, e.GOOGLE_CLIENT_SECRET],
      github: [e.GITHUB_CLIENT_ID, e.GITHUB_CLIENT_SECRET],
      facebook: [e.FACEBOOK_CLIENT_ID, e.FACEBOOK_CLIENT_SECRET],
      linkedin: [e.LINKEDIN_CLIENT_ID, e.LINKEDIN_CLIENT_SECRET],
    };
    const [clientId, clientSecret] = map[provider];
    return clientId && clientSecret ? { clientId, clientSecret } : null;
  }

  get facebookGraphVersion(): string { return this.env.FACEBOOK_GRAPH_VERSION; }
  get developerSelfEnroll(): boolean { return this.env.DEVELOPER_SELF_ENROLL; }
  get swaggerEnabled(): boolean { return this.env.SWAGGER_ENABLED; }
  get auditRetentionDays(): number { return this.env.AUDIT_RETENTION_DAYS; }
}

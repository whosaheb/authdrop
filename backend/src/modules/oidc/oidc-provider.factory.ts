import { Logger } from '@nestjs/common';
import Provider, { type Configuration, type KoaContextWithOIDC } from 'oidc-provider';
import { type AppConfig } from '../../config/app-config.service.js';
import { loadJwks } from '../../config/jwks.loader.js';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { INTERACTION_COOKIE, SESSION_COOKIE } from '../../common/constants/cookies.js';
import { escapeHtml } from '../../common/helpers/email.helper.js';
import { type CryptoService } from '../../common/crypto/crypto.service.js';
import { type PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { type RedisService } from '../../infrastructure/redis/redis.service.js';
import { type AuditService } from '../audit/audit.service.js';
import { type SessionService } from '../auth-core/session.service.js';
import { createAdapterClass } from './adapters/adapter.factory.js';
import { type ConsentService } from './consent.service.js';
import { OIDC_MOUNT_PATH, OIDC_ROUTES, SUPPORTED_SCOPES } from './oidc.constants.js';

export interface OidcProviderDeps {
  config: AppConfig;
  prisma: PrismaService;
  redis: RedisService;
  crypto: CryptoService;
  audit: AuditService;
  consent: ConsentService;
  sessions: SessionService;
}

const DAY = 24 * 60 * 60;
const logger = new Logger('OidcProvider');

const PAGE_STYLE = `body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f4f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#14171f}
main{background:#fff;border:1px solid #e4e6eb;border-radius:12px;padding:32px;max-width:420px;width:calc(100% - 32px);box-sizing:border-box}
h1{font-size:20px;margin:0 0 12px}p{line-height:1.5;color:#4b5563}
button{font:inherit;padding:10px 16px;border-radius:8px;border:1px solid #d1d5db;background:#fff;cursor:pointer;margin:4px 8px 0 0}
button[value=yes]{background:#14171f;color:#fff;border-color:#14171f}`;

const page = (title: string, body: string) =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><style>${PAGE_STYLE}</style></head><body><main>${body}</main></body></html>`;

/** Builds the oidc-provider instance with AuthDrop's policy. Throws on invalid configuration (fail fast). */
export async function createOidcProvider(deps: OidcProviderDeps): Promise<Provider> {
  const { config, prisma, redis, crypto, audit, consent, sessions } = deps;
  const jwks = await loadJwks(config, (message) => logger.warn(message));
  const supportedScopes = new Set<string>(SUPPORTED_SCOPES);

  const configuration: Configuration = {
    adapter: createAdapterClass({ redis: redis.client, prisma, crypto }),
    jwks: jwks as Configuration['jwks'],
    routes: { ...OIDC_ROUTES },
    scopes: [...SUPPORTED_SCOPES],
    claims: {
      openid: ['sub'],
      email: ['email', 'email_verified'],
      profile: ['name', 'given_name', 'family_name', 'picture', 'gender', 'birthdate', 'updated_at'],
    },

    cookies: {
      keys: config.oidc.cookieKeys,
      long: { signed: true, sameSite: 'lax', httpOnly: true },
      short: { signed: true, sameSite: 'lax', httpOnly: true },
    },

    ttl: {
      AccessToken: 10 * 60,
      AuthorizationCode: 60,
      IdToken: 10 * 60,
      RefreshToken: 14 * DAY,
      Interaction: 10 * 60,
      Session: 14 * DAY,
      Grant: 14 * DAY,
    },

    // PKCE is mandatory for public clients and (by default) for confidential ones too (OAuth 2.1 posture).
    pkce: {
      required: (_ctx, client) => config.oidc.requirePkce || client.clientAuthMethod === 'none',
    },
    rotateRefreshToken: true,

    features: {
      devInteractions: { enabled: false },
      introspection: { enabled: true },
      revocation: { enabled: true },
      rpInitiatedLogout: {
        enabled: true,
        logoutSource: (ctx, form) => {
          ctx.type = 'html';
          ctx.body = page(
            'Sign out',
            `<h1>Sign out of AuthDrop?</h1><p>You will be signed out of AuthDrop and every app that uses it on this device.</p>${form}
             <button autofocus type="submit" form="op.logoutForm" value="yes" name="logout">Yes, sign me out</button>
             <button type="submit" form="op.logoutForm">No, stay signed in</button>`,
          );
        },
        postLogoutSuccessSource: (ctx) => {
          ctx.type = 'html';
          ctx.body = page('Signed out', '<h1>You are signed out</h1><p>You can close this window.</p>');
        },
      },
    },

    // Login happens in the React portal; the provider only needs to know where to send the browser.
    // The uid is also bound to the initiating browser through an HttpOnly cookie. Every portal endpoint that
    // touches an interaction checks it, so a victim cannot be tricked into completing an attacker's login flow.
    interactions: {
      url: (ctx, interaction) => {
        ctx.cookies.set(INTERACTION_COOKIE, interaction.uid, {
          httpOnly: true,
          secure: config.secureCookies,
          sameSite: 'lax',
          path: '/',
          maxAge: 10 * 60 * 1000,
          signed: false,
          overwrite: true,
        });
        return `${config.appUrl}/login?uid=${encodeURIComponent(interaction.uid)}`;
      },
    },

    findAccount: async (_ctx, sub) => {
      const user = await prisma.user.findFirst({ where: { id: sub, status: 'ACTIVE' } });
      if (!user) return undefined;
      return {
        accountId: user.id,
        claims: async () => ({
          sub: user.id,
          email: user.email,
          email_verified: user.emailVerifiedAt !== null,
          name: `${user.firstName} ${user.lastName}`.trim(),
          given_name: user.firstName,
          family_name: user.lastName,
          picture: user.avatarUrl ?? undefined,
          gender: user.gender?.toLowerCase().replace(/_/g, ' '),
          birthdate: user.dateOfBirth?.toISOString().slice(0, 10),
          updated_at: Math.floor(user.updatedAt.getTime() / 1000),
        }),
      };
    },

    /**
     * Auto-approve registered clients, EXCEPT where the user revoked the app: then returning undefined
     * forces the consent prompt, which the portal renders (see InteractionService / AuthController).
     */
    loadExistingGrant: async (ctx: KoaContextWithOIDC) => {
      const accountId = ctx.oidc.session?.accountId;
      const clientId = ctx.oidc.client?.clientId;
      if (!accountId || !clientId) return undefined;

      const requested = String(ctx.oidc.params?.scope ?? 'openid')
        .split(' ')
        .filter((scope) => supportedScopes.has(scope));
      const revoked = await consent.isRevoked(accountId, clientId);

      const grantId =
        (ctx.oidc.result?.consent as { grantId?: string } | undefined)?.grantId ?? ctx.oidc.session?.grantIdFor(clientId);
      if (grantId) {
        const existing = await ctx.oidc.provider.Grant.find(grantId);
        if (existing) {
          const have = new Set(String(existing.openid?.scope ?? '').split(' '));
          if (!revoked && requested.some((scope) => !have.has(scope))) {
            existing.addOIDCScope(requested.join(' '));
            await existing.save();
          }
          return existing;
        }
      }
      if (revoked) return undefined;

      const grant = new ctx.oidc.provider.Grant({ accountId, clientId });
      grant.addOIDCScope(requested.join(' '));
      await grant.save();
      await consent.markGranted(accountId, clientId);
      return grant;
    },

    // Browser-based clients may call /token and /userinfo cross-origin from their own registered origins only.
    clientBasedCORS: (_ctx, origin, client) =>
      (client.redirectUris ?? []).some((uri) => {
        try {
          return new URL(uri).origin === origin;
        } catch {
          return false;
        }
      }),

    renderError: (ctx, out) => {
      ctx.type = 'html';
      ctx.body = page(
        'Something went wrong',
        `<h1>Something went wrong</h1><p>${escapeHtml(String(out.error_description ?? out.error))}</p><p>Return to the application and try again.</p>`,
      );
    },
  };

  const provider = new Provider(config.issuer, configuration);
  provider.proxy = config.trustProxy; // honour X-Forwarded-Proto/-Host behind the TLS terminator

  const actor = (ctx: KoaContextWithOIDC) => (ctx.oidc?.session?.accountId as string | undefined) ?? null;
  const meta = (ctx: KoaContextWithOIDC) => ({ ip: ctx.ip, userAgent: ctx.get('user-agent').slice(0, 255) });

  provider.on('authorization.success', (ctx: KoaContextWithOIDC) => {
    void audit.record({
      event: AuditEvent.OidcAuthorization,
      actorId: actor(ctx),
      targetType: 'client',
      targetId: ctx.oidc.client?.clientId,
      ...meta(ctx),
    });
  });

  provider.on('grant.success', (ctx: KoaContextWithOIDC) => {
    void audit.record({
      event: AuditEvent.OidcTokenGranted,
      actorId: actor(ctx),
      targetType: 'client',
      targetId: ctx.oidc.client?.clientId,
      metadata: { grantType: ctx.oidc.params?.grant_type },
      ...meta(ctx),
    });
  });

  provider.on('end_session.success', (ctx: KoaContextWithOIDC) => {
    void audit.record({ event: AuditEvent.OidcLogout, actorId: actor(ctx), ...meta(ctx) });
    // Single logout: signing out of the IdP also ends the portal session in this browser.
    const portalSessionId = ctx.cookies.get(SESSION_COOKIE);
    if (portalSessionId) {
      void sessions.destroy(portalSessionId);
      ctx.cookies.set(SESSION_COOKIE, null, { path: '/' });
    }
  });

  provider.on('server_error', (ctx: KoaContextWithOIDC, error: Error) => {
    logger.error({ msg: 'oidc server_error', path: ctx.path, err: error.message });
    void audit.record({
      event: AuditEvent.OidcError,
      outcome: 'FAILURE',
      targetType: 'client',
      targetId: ctx.oidc?.client?.clientId,
      metadata: { error: error.name },
      ...meta(ctx),
    });
  });

  return provider;
}

export { OIDC_MOUNT_PATH };

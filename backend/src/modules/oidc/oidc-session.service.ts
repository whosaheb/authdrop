import { Inject, Injectable } from '@nestjs/common';
import type Provider from 'oidc-provider';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { accountSessionsKey, oidcKey } from './adapters/redis.adapter.js';
import { OIDC_PROVIDER } from './oidc.constants.js';

/** Terminates provider-side state (SSO sessions, tokens) for an account. */
@Injectable()
export class OidcSessionService {
  constructor(
    @Inject(OIDC_PROVIDER) private readonly provider: Provider,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  /** Ends every provider SSO session of the account: the next /authorize prompts for login again. */
  async endAllSessions(accountId: string): Promise<void> {
    const indexKey = accountSessionsKey(accountId);
    const ids = await this.redis.client.smembers(indexKey);
    await this.redis.del(...ids.map((id) => oidcKey('Session', id)), indexKey);
  }

  /** Ends only the SSO session of the browser that is signing out (identified by the provider's `_session` cookie). */
  async endBrowserSession(oidcSessionId: string | undefined, accountId: string): Promise<void> {
    if (!oidcSessionId || !/^[\w-]{20,64}$/.test(oidcSessionId)) return;
    await this.redis.del(oidcKey('Session', oidcSessionId));
    await this.redis.client.srem(accountSessionsKey(accountId), oidcSessionId);
  }

  /** Revokes every token and grant issued to relying parties for this account. */
  async revokeAllGrants(accountId: string): Promise<void> {
    const grants = await this.prisma.oidcGrant.findMany({ where: { accountId }, select: { id: true } });
    await Promise.all(grants.map((grant) => this.revokeGrantArtefacts(grant.id)));
    await this.prisma.oidcGrant.deleteMany({ where: { accountId } });
  }

  async revokeGrantArtefacts(grantId: string): Promise<void> {
    await Promise.all([
      this.provider.AccessToken.revokeByGrantId(grantId),
      this.provider.RefreshToken.revokeByGrantId(grantId),
      this.provider.AuthorizationCode.revokeByGrantId(grantId),
    ]);
  }
}

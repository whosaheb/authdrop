import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { ConsentService } from './consent.service.js';
import { OidcSessionService } from './oidc-session.service.js';

export interface ConnectedApp {
  clientId: string;
  name: string;
  scopes: string[];
  authorizedAt: Date;
}

/** Backs the "Connected apps" tab: what the user has authorised, and the ability to take it back. */
@Injectable()
export class ConnectedAppsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly consent: ConsentService,
    private readonly oidcSessions: OidcSessionService,
  ) {}

  async list(userId: string): Promise<ConnectedApp[]> {
    const grants = await this.prisma.oidcGrant.findMany({
      where: { accountId: userId, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (grants.length === 0) return [];

    const clients = await this.prisma.client.findMany({
      where: { clientId: { in: [...new Set(grants.map((g) => g.clientId))] } },
      select: { clientId: true, name: true },
    });
    const names = new Map(clients.map((c) => [c.clientId, c.name]));

    // One row per app: the most recent grant wins (a new grant is created per fresh authorization).
    const byClient = new Map<string, ConnectedApp>();
    for (const grant of grants) {
      if (byClient.has(grant.clientId)) continue;
      const openid = (grant.payload as { openid?: { scope?: string } }).openid;
      byClient.set(grant.clientId, {
        clientId: grant.clientId,
        name: names.get(grant.clientId) ?? grant.clientId,
        scopes: String(openid?.scope ?? '').split(' ').filter(Boolean),
        authorizedAt: grant.createdAt,
      });
    }
    return [...byClient.values()];
  }

  /**
   * Revokes an app for this user: kills its tokens, deletes the grant(s) and flags the app as revoked,
   * so a later sign-in through SSO shows a consent prompt instead of silently re-approving.
   */
  async revoke(userId: string, clientId: string): Promise<boolean> {
    const grants = await this.prisma.oidcGrant.findMany({ where: { accountId: userId, clientId }, select: { id: true } });
    if (grants.length === 0) return false;
    await Promise.all(grants.map((g) => this.oidcSessions.revokeGrantArtefacts(g.id)));
    await this.prisma.oidcGrant.deleteMany({ where: { accountId: userId, clientId } });
    await this.consent.markRevoked(userId, clientId);
    return true;
  }
}

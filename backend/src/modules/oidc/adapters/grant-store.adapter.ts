import { type Adapter, type AdapterPayload } from 'oidc-provider';
import { type Prisma } from '../../../generated/prisma/client.js';
import { type PrismaService } from '../../../infrastructure/prisma/prisma.service.js';

/**
 * oidc-provider "Grant" records (what a user authorised for which client) are durable business data,
 * so they live in PostgreSQL and can be listed per user for the "Connected apps" screen.
 */
export class GrantStoreAdapter implements Adapter {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void> {
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    const data = {
      accountId: String(payload.accountId),
      clientId: String(payload.clientId),
      payload: payload as unknown as Prisma.InputJsonObject,
      expiresAt,
    };
    await this.prisma.oidcGrant.upsert({ where: { id }, create: { id, ...data }, update: data });
  }

  async find(id: string): Promise<AdapterPayload | undefined> {
    const row = await this.prisma.oidcGrant.findUnique({ where: { id } });
    if (!row || row.expiresAt.getTime() <= Date.now()) return undefined;
    return row.payload as unknown as AdapterPayload;
  }

  async destroy(id: string): Promise<void> {
    await this.prisma.oidcGrant.deleteMany({ where: { id } });
  }

  // Grants are not addressable by uid / user code, are never "consumed" and own no child artefacts.
  async findByUid(): Promise<undefined> { return undefined; }
  async findByUserCode(): Promise<undefined> { return undefined; }
  async consume(): Promise<void> { /* not applicable */ }
  async revokeByGrantId(): Promise<void> { /* not applicable */ }
}

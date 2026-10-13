import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { randomToken } from '../../common/helpers/crypto.helper.js';
import { type RequestMeta } from '../../common/helpers/request.helper.js';
import { type Client } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { OidcSessionService } from '../oidc/oidc-session.service.js';
import {
  type ClientCredentialsResponseDto,
  type ClientLogsResponseDto,
  type ClientMetricsResponseDto,
  type ClientResponseDto,
  type CreateClientDto,
  type UpdateClientDto,
} from './dto/client.dto.js';

export const MAX_CLIENTS_PER_USER = 25;

export function toClientDto(client: Client): ClientResponseDto {
  return {
    clientId: client.clientId,
    name: client.name,
    clientType: client.clientType,
    tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
    redirectUris: client.redirectUris,
    postLogoutRedirectUris: client.postLogoutRedirectUris,
    createdAt: client.createdAt.toISOString(),
    updatedAt: client.updatedAt.toISOString(),
  };
}

/** Relying-party registry. Secrets are stored encrypted and returned in plaintext exactly once. */
@Injectable()
export class ClientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly oidcSessions: OidcSessionService,
  ) {}

  list(ownerId: string): Promise<Client[]> {
    return this.prisma.client.findMany({ where: { ownerId }, orderBy: { createdAt: 'desc' } });
  }

  /** Ownership is enforced in the query: someone else's client looks exactly like a missing one. */
  private async findOwned(ownerId: string, clientId: string): Promise<Client> {
    const client = await this.prisma.client.findFirst({ where: { clientId, ownerId } });
    if (!client) throw new NotFoundException('Client not found');
    return client;
  }

  get(ownerId: string, clientId: string): Promise<Client> {
    return this.findOwned(ownerId, clientId);
  }

  async create(ownerId: string, dto: CreateClientDto, meta: RequestMeta): Promise<ClientCredentialsResponseDto> {
    if ((await this.prisma.client.count({ where: { ownerId } })) >= MAX_CLIENTS_PER_USER) {
      throw new ForbiddenException(`You can register at most ${MAX_CLIENTS_PER_USER} applications`);
    }
    const isPublic = dto.clientType === 'PUBLIC';
    const clientId = `ad_${randomToken(18)}`;
    const secret = isPublic ? null : randomToken(36);

    const client = await this.prisma.client.create({
      data: {
        clientId,
        name: dto.name,
        ownerId,
        clientType: isPublic ? 'PUBLIC' : 'CONFIDENTIAL',
        tokenEndpointAuthMethod: isPublic ? 'NONE' : (dto.tokenEndpointAuthMethod ?? 'CLIENT_SECRET_BASIC'),
        clientSecretEnc: secret ? this.crypto.encrypt(secret) : null,
        redirectUris: dto.redirectUris,
        postLogoutRedirectUris: dto.postLogoutRedirectUris ?? [],
      },
    });
    await this.audit.record({ event: AuditEvent.ClientCreated, actorId: ownerId, targetType: 'client', targetId: clientId, metadata: { name: dto.name }, ...meta });
    return { ...toClientDto(client), clientSecret: secret };
  }

  async update(ownerId: string, clientId: string, dto: UpdateClientDto, meta: RequestMeta): Promise<Client> {
    await this.findOwned(ownerId, clientId);
    const client = await this.prisma.client.update({
      where: { clientId },
      data: { name: dto.name, redirectUris: dto.redirectUris, postLogoutRedirectUris: dto.postLogoutRedirectUris },
    });
    await this.audit.record({ event: AuditEvent.ClientUpdated, actorId: ownerId, targetType: 'client', targetId: clientId, metadata: { fields: Object.keys(dto) }, ...meta });
    return client;
  }

  /** Old secret stops working immediately. Public clients have no secret to rotate. */
  async rotateSecret(ownerId: string, clientId: string, meta: RequestMeta): Promise<ClientCredentialsResponseDto> {
    const existing = await this.findOwned(ownerId, clientId);
    if (existing.clientType === 'PUBLIC') throw new ForbiddenException('Public clients do not have a secret');
    const secret = randomToken(36);
    const client = await this.prisma.client.update({ where: { clientId }, data: { clientSecretEnc: this.crypto.encrypt(secret) } });
    await this.audit.record({ event: AuditEvent.ClientSecretRotated, actorId: ownerId, targetType: 'client', targetId: clientId, ...meta });
    return { ...toClientDto(client), clientSecret: secret };
  }

  /** Deleting an app also kills every token and grant that was issued to it. */
  async remove(ownerId: string, clientId: string, meta: RequestMeta): Promise<void> {
    await this.findOwned(ownerId, clientId);
    const grants = await this.prisma.oidcGrant.findMany({ where: { clientId }, select: { id: true } });
    await Promise.all(grants.map((g) => this.oidcSessions.revokeGrantArtefacts(g.id)));
    await this.prisma.oidcGrant.deleteMany({ where: { clientId } });
    await this.prisma.client.delete({ where: { clientId } });
    await this.audit.record({ event: AuditEvent.ClientDeleted, actorId: ownerId, targetType: 'client', targetId: clientId, ...meta });
  }

  async logs(ownerId: string, clientId: string, limit: number, cursor?: string): Promise<ClientLogsResponseDto> {
    await this.findOwned(ownerId, clientId);
    const page = await this.audit.listForClient(clientId, { limit, beforeId: cursor });
    return {
      // Deliberately omits IP / user agent: those are personal data of end users, not the developer's.
      items: page.items.map((row) => ({
        id: row.id.toString(),
        occurredAt: row.occurredAt.toISOString(),
        event: row.event,
        outcome: row.outcome,
        sub: row.actorId,
      })),
      nextCursor: page.nextCursor,
    };
  }

  async metrics(ownerId: string, clientId: string, windowDays = 30): Promise<ClientMetricsResponseDto> {
    await this.findOwned(ownerId, clientId);
    const [activeUsers, daily] = await Promise.all([
      this.prisma.oidcGrant.groupBy({ by: ['accountId'], where: { clientId, expiresAt: { gt: new Date() } } }).then((rows) => rows.length),
      this.audit.dailyClientEventCounts(clientId, windowDays),
    ]);
    return { activeUsers, windowDays, daily };
  }
}

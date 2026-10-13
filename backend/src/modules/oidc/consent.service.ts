import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

/**
 * Remembers whether a user currently allows a client.
 *
 * AuthDrop auto-approves registered clients (a normal IdP "first-party" posture) UNLESS the user
 * explicitly revoked that app - then a real consent screen is forced before access is restored.
 */
@Injectable()
export class ConsentService {
  constructor(private readonly prisma: PrismaService) {}

  async isRevoked(userId: string, clientId: string): Promise<boolean> {
    const row = await this.prisma.userClientConsent.findUnique({ where: { userId_clientId: { userId, clientId } } });
    return row?.status === 'REVOKED';
  }

  async markGranted(userId: string, clientId: string): Promise<void> {
    await this.prisma.userClientConsent.upsert({
      where: { userId_clientId: { userId, clientId } },
      create: { userId, clientId, status: 'GRANTED' },
      update: { status: 'GRANTED' },
    });
  }

  async markRevoked(userId: string, clientId: string): Promise<void> {
    await this.prisma.userClientConsent.upsert({
      where: { userId_clientId: { userId, clientId } },
      create: { userId, clientId, status: 'REVOKED' },
      update: { status: 'REVOKED' },
    });
  }
}

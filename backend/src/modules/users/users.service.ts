import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { Prisma, type SocialProviderType, type User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import { type SocialLink } from '../auth-core/preauth.service.js';
import { type UpdateProfileDto } from './dto/user.dto.js';
import { type UserWithSocial } from './users.mapper.js';

export interface CreateUserInput {
  email: string;
  firstName: string;
  lastName: string;
  social?: SocialLink;
}

const toProviderType = (provider: string): SocialProviderType => provider.toUpperCase() as SocialProviderType;

/** Persistence rules for user records. Emails are always stored lower-cased. */
@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  findActiveById(id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, status: 'ACTIVE' } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findBySocial(link: SocialLink): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: { socialAccounts: { some: { provider: toProviderType(link.provider), providerUserId: link.providerUserId } } },
    });
  }

  getWithSocial(id: string): Promise<UserWithSocial | null> {
    return this.prisma.user.findUnique({ where: { id }, include: { socialAccounts: { orderBy: { createdAt: 'asc' } } } });
  }

  /** Creates the account of a verified e-mail. A concurrent duplicate surfaces as 409, never as a 500. */
  async create(input: CreateUserInput): Promise<User> {
    try {
      return await this.prisma.user.create({
        data: {
          email: input.email,
          emailVerifiedAt: new Date(),
          firstName: input.firstName,
          lastName: input.lastName,
          lastLoginAt: new Date(),
          ...(input.social
            ? {
                socialAccounts: {
                  create: { provider: toProviderType(input.social.provider), providerUserId: input.social.providerUserId, email: input.email },
                },
              }
            : {}),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async linkSocial(userId: string, link: SocialLink, email: string): Promise<boolean> {
    try {
      await this.prisma.socialAccount.create({
        data: { userId, provider: toProviderType(link.provider), providerUserId: link.providerUserId, email },
      });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return false; // already linked
      throw error;
    }
  }

  markLogin(id: string): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { lastLoginAt: new Date(), emailVerifiedAt: undefined } });
  }

  async markEmailVerified(id: string): Promise<void> {
    await this.prisma.user.updateMany({ where: { id, emailVerifiedAt: null }, data: { emailVerifiedAt: new Date() } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto): Promise<User> {
    let dateOfBirth: Date | null | undefined;
    if (dto.dateOfBirth === null) dateOfBirth = null;
    else if (dto.dateOfBirth !== undefined) dateOfBirth = this.parseBirthDate(dto.dateOfBirth);

    return this.prisma.user.update({
      where: { id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        gender: dto.gender,
        dateOfBirth,
      },
    });
  }

  private parseBirthDate(value: string): Date {
    const date = new Date(`${value}T00:00:00.000Z`);
    const valid = !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
    if (!valid) throw new BadRequestException('dateOfBirth is not a valid calendar date');
    if (date.getTime() > Date.now()) throw new BadRequestException('dateOfBirth cannot be in the future');
    if (date.getUTCFullYear() < 1900) throw new BadRequestException('dateOfBirth is too far in the past');
    return date;
  }

  /** Stores the new picture first, swaps the pointer, then deletes the old object (never leaves a dangling URL). */
  async replaceAvatar(userId: string, image: Buffer): Promise<User> {
    const previous = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
    const stored = await this.storage.uploadAvatar(userId, image);
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarKey: stored.key, avatarUrl: stored.url } });
    if (previous.avatarKey) await this.storage.deleteObject(previous.avatarKey);
    return user;
  }

  async removeAvatar(userId: string): Promise<User> {
    const previous = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { avatarKey: true } });
    const user = await this.prisma.user.update({ where: { id: userId }, data: { avatarKey: null, avatarUrl: null } });
    if (previous.avatarKey) await this.storage.deleteObject(previous.avatarKey);
    return user;
  }

  /** Right to erasure. FK cascades remove backup codes, social links, clients (and their consents). */
  async deleteAccount(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { avatarKey: true } });
    await this.prisma.user.delete({ where: { id: userId } });
    if (user?.avatarKey) await this.storage.deleteObject(user.avatarKey);
  }

  /** Right of access / portability: everything we hold about the user, without secrets. */
  async exportData(userId: string): Promise<Record<string, unknown>> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: { socialAccounts: true, consents: true, clients: true },
    });
    return {
      exportedAt: new Date().toISOString(),
      profile: {
        id: user.id,
        email: user.email,
        emailVerifiedAt: user.emailVerifiedAt,
        firstName: user.firstName,
        lastName: user.lastName,
        gender: user.gender,
        dateOfBirth: user.dateOfBirth,
        avatarUrl: user.avatarUrl,
        role: user.role,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
      },
      security: { totpEnabled: user.totpEnabled, totpEnabledAt: user.totpEnabledAt },
      linkedSocialAccounts: user.socialAccounts.map((a) => ({ provider: a.provider, linkedAt: a.createdAt })),
      appConsents: user.consents.map((c) => ({ clientId: c.clientId, status: c.status, updatedAt: c.updatedAt })),
      registeredClients: user.clients.map((c) => ({ clientId: c.clientId, name: c.name, createdAt: c.createdAt })),
    };
  }
}

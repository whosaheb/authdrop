import { type SocialAccount, type User } from '../../generated/prisma/client.js';
import { type UserResponseDto } from './dto/user.dto.js';

export type UserWithSocial = User & { socialAccounts?: SocialAccount[] };

export function toUserDto(user: UserWithSocial, avatarUploadEnabled: boolean): UserResponseDto {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerifiedAt !== null,
    firstName: user.firstName,
    lastName: user.lastName,
    gender: user.gender,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    avatarUrl: user.avatarUrl,
    role: user.role,
    totpEnabled: user.totpEnabled,
    linkedProviders: (user.socialAccounts ?? []).map((a) => ({ provider: a.provider.toLowerCase(), linkedAt: a.createdAt.toISOString() })),
    avatarUploadEnabled,
    createdAt: user.createdAt.toISOString(),
  };
}

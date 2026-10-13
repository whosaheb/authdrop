import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import QRCode from 'qrcode';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { generateBackupCode, normalizeBackupCode } from '../../common/helpers/crypto.helper.js';
import { buildOtpauthUrl, generateTotpSecret, verifyTotp } from '../../common/helpers/totp.helper.js';
import { type RequestMeta } from '../../common/helpers/request.helper.js';
import { type User } from '../../generated/prisma/client.js';
import { MailService } from '../../infrastructure/mail/mail.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { type MfaStatusResponseDto, type SecondFactorDto, type TotpSetupResponseDto } from './dto/mfa.dto.js';

const BACKUP_CODE_COUNT = 10;
const SETUP_TTL_SECONDS = 600;
const setupKey = (userId: string) => `mfa:setup:${userId}`;
const usedStepKey = (userId: string, counter: number) => `mfa:used:${userId}:${counter}`;

/** Authenticator-app (TOTP) enrolment, verification and single-use recovery codes. */
@Injectable()
export class MfaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly crypto: CryptoService,
    private readonly audit: AuditService,
    private readonly mail: MailService,
  ) {}

  async status(user: User): Promise<MfaStatusResponseDto> {
    const remaining = user.totpEnabled ? await this.prisma.backupCode.count({ where: { userId: user.id, usedAt: null } }) : 0;
    return { enabled: user.totpEnabled, enabledAt: user.totpEnabledAt?.toISOString() ?? null, backupCodesRemaining: remaining };
  }

  /** Step 1 of enrolment. The pending secret lives only in Redis (encrypted) until the user proves possession. */
  async beginSetup(user: User): Promise<TotpSetupResponseDto> {
    if (user.totpEnabled) throw new ConflictException('Authenticator app is already enabled');
    const secret = generateTotpSecret();
    await this.redis.client.set(setupKey(user.id), this.crypto.encrypt(secret), 'EX', SETUP_TTL_SECONDS);
    const otpauthUrl = buildOtpauthUrl({ secret, accountName: user.email, issuer: 'AuthDrop' });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl, { errorCorrectionLevel: 'M', margin: 1, width: 240 });
    return { secret, otpauthUrl, qrCodeDataUrl };
  }

  /** Step 2: confirm with a code, persist the encrypted secret and mint the recovery codes (returned once). */
  async confirmSetup(user: User, code: string, meta: RequestMeta): Promise<string[]> {
    if (user.totpEnabled) throw new ConflictException('Authenticator app is already enabled');
    const encrypted = await this.redis.client.get(setupKey(user.id));
    if (!encrypted) throw new BadRequestException('Setup expired. Start again.');
    const secret = this.crypto.decrypt(encrypted);

    const counter = verifyTotp(secret, code);
    if (counter === null) {
      await this.audit.record({ event: AuditEvent.MfaFailed, outcome: 'FAILURE', actorId: user.id, metadata: { stage: 'enrol' }, ...meta });
      throw new UnauthorizedException('That code is not valid. Check your device clock and try again.');
    }
    await this.claimStep(user.id, counter);

    const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: this.crypto.encrypt(secret), totpEnabled: true, totpEnabledAt: new Date() } }),
      this.prisma.backupCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.backupCode.createMany({ data: codes.map((c) => ({ userId: user.id, codeHash: this.hashBackup(user.id, c) })) }),
    ]);
    await this.redis.del(setupKey(user.id));
    await this.audit.record({ event: AuditEvent.MfaEnabled, actorId: user.id, targetType: 'user', targetId: user.id, ...meta });
    void this.mail.sendSecurityNoticeSafe(user.email, 'Two-step verification enabled', 'Authenticator app enabled', 'An authenticator app was added to your AuthDrop account. If this was not you, secure your account immediately.');
    return codes;
  }

  /**
   * Verifies a TOTP code or backup code for a user that has MFA enabled.
   * TOTP steps are single-use (replay protection); backup codes are consumed atomically.
   */
  async verifySecondFactor(user: User, factor: SecondFactorDto, meta: RequestMeta): Promise<boolean> {
    if (!user.totpEnabled || !user.totpSecretEnc) return false;

    if (factor.backupCode) {
      const hash = this.hashBackup(user.id, normalizeBackupCode(factor.backupCode));
      const { count } = await this.prisma.backupCode.updateMany({ where: { userId: user.id, codeHash: hash, usedAt: null }, data: { usedAt: new Date() } });
      if (count === 1) {
        await this.audit.record({ event: AuditEvent.BackupCodeUsed, actorId: user.id, targetType: 'user', targetId: user.id, ...meta });
        void this.mail.sendSecurityNoticeSafe(user.email, 'A recovery code was used', 'Recovery code used', 'A single-use recovery code was used to sign in to your AuthDrop account. If this was not you, regenerate your codes and review your sessions.');
        return true;
      }
    } else if (factor.code) {
      const counter = verifyTotp(this.crypto.decrypt(user.totpSecretEnc), factor.code);
      if (counter !== null && (await this.tryClaimStep(user.id, counter))) return true;
    }

    await this.audit.record({ event: AuditEvent.MfaFailed, outcome: 'FAILURE', actorId: user.id, ...meta });
    return false;
  }

  async disable(user: User, factor: SecondFactorDto, meta: RequestMeta): Promise<void> {
    if (!user.totpEnabled) throw new BadRequestException('Authenticator app is not enabled');
    await this.requireSecondFactor(user, factor, meta);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { totpSecretEnc: null, totpEnabled: false, totpEnabledAt: null } }),
      this.prisma.backupCode.deleteMany({ where: { userId: user.id } }),
    ]);
    await this.audit.record({ event: AuditEvent.MfaDisabled, actorId: user.id, targetType: 'user', targetId: user.id, ...meta });
    void this.mail.sendSecurityNoticeSafe(user.email, 'Two-step verification disabled', 'Authenticator app removed', 'Two-step verification was turned off for your AuthDrop account. If this was not you, secure your account immediately.');
  }

  async regenerateBackupCodes(user: User, factor: SecondFactorDto, meta: RequestMeta): Promise<string[]> {
    if (!user.totpEnabled) throw new BadRequestException('Enable the authenticator app first');
    await this.requireSecondFactor(user, factor, meta);
    const codes = Array.from({ length: BACKUP_CODE_COUNT }, generateBackupCode);
    await this.prisma.$transaction([
      this.prisma.backupCode.deleteMany({ where: { userId: user.id } }),
      this.prisma.backupCode.createMany({ data: codes.map((c) => ({ userId: user.id, codeHash: this.hashBackup(user.id, c) })) }),
    ]);
    await this.audit.record({ event: AuditEvent.BackupCodesRegenerated, actorId: user.id, targetType: 'user', targetId: user.id, ...meta });
    return codes;
  }

  /** Step-up for sensitive actions: recovery codes are NOT accepted so they cannot be used to strip MFA off the account. */
  private async requireSecondFactor(user: User, factor: SecondFactorDto, meta: RequestMeta): Promise<void> {
    if (!factor.code) throw new BadRequestException('An authenticator code is required for this action');
    const ok = await this.verifySecondFactor(user, { code: factor.code }, meta);
    if (!ok) throw new UnauthorizedException('That code is not valid');
  }

  private hashBackup(userId: string, code: string): string {
    return this.crypto.hmac(`backup:${userId}:${code}`);
  }

  private async tryClaimStep(userId: string, counter: number): Promise<boolean> {
    const acquired = await this.redis.client.set(usedStepKey(userId, counter), '1', 'EX', 120, 'NX');
    return acquired === 'OK';
  }

  private async claimStep(userId: string, counter: number): Promise<void> {
    await this.tryClaimStep(userId, counter);
  }
}

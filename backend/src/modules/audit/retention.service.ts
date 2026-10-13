import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from './audit.service.js';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

/** Data-retention housekeeping (SOC 2 C1.2 / P4.2): old audit rows and expired grants are removed on a schedule. */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.run(), SIX_HOURS_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      const audits = await this.audit.pruneOlderThan(this.config.auditRetentionDays);
      const grants = await this.prisma.oidcGrant.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      this.logger.log({ msg: 'Retention run finished', auditRowsDeleted: audits, grantsDeleted: grants.count });
    } catch (error) {
      this.logger.error({ msg: 'Retention run failed', err: String(error) });
    }
  }
}

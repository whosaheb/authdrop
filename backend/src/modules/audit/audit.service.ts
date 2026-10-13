import { Injectable, Logger } from '@nestjs/common';
import { type AuditOutcome, type Prisma } from '../../generated/prisma/client.js';
import { type AuditEventName } from '../../common/constants/audit-events.js';
import { sha256Hex } from '../../common/helpers/crypto.helper.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';

export interface AuditEntry {
  event: AuditEventName;
  outcome?: AuditOutcome;
  actorId?: string | null;
  targetType?: string;
  targetId?: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
  /** Never put secrets, OTPs or raw tokens here. */
  metadata?: Record<string, unknown>;
}

/** Arbitrary constant: serialises chain appends across all app instances via a Postgres advisory lock. */
const AUDIT_CHAIN_LOCK = 7_340_021;

/**
 * Append-only audit trail. Each row stores the hash of the previous row, so deleting or editing
 * history is detectable with verifyChain() (SOC 2 CC7.2, CC7.3, CC4.1 evidence).
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Never throws: an audit outage must not take authentication down, but it is logged loudly. */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK})`;
        const last = await tx.auditLog.findFirst({ orderBy: { id: 'desc' }, select: { hash: true } });
        const occurredAt = new Date();
        const outcome: AuditOutcome = entry.outcome ?? 'SUCCESS';
        const prevHash = last?.hash ?? null;
        const hash = AuditService.computeHash({
          prevHash,
          occurredAt: occurredAt.toISOString(),
          event: entry.event,
          outcome,
          actorId: entry.actorId ?? null,
          targetType: entry.targetType ?? null,
          targetId: entry.targetId ?? null,
          ip: entry.ip ?? null,
          requestId: entry.requestId ?? null,
          metadata: entry.metadata ?? null,
        });
        await tx.auditLog.create({
          data: {
            occurredAt,
            event: entry.event,
            outcome,
            actorId: entry.actorId ?? null,
            targetType: entry.targetType ?? null,
            targetId: entry.targetId ?? null,
            ip: entry.ip ?? null,
            userAgent: entry.userAgent ?? null,
            requestId: entry.requestId ?? null,
            metadata: (entry.metadata ?? undefined) as Prisma.InputJsonObject | undefined,
            prevHash,
            hash,
          },
        });
      });
    } catch (error) {
      this.logger.error({ msg: 'AUDIT WRITE FAILED', event: entry.event, err: String(error) });
    }
  }

  private static computeHash(fields: Record<string, unknown>): string {
    return sha256Hex(JSON.stringify(fields));
  }

  /** Re-computes the chain for the most recent `limit` rows. Returns the first broken row id, if any. */
  async verifyChain(limit = 5000): Promise<{ checked: number; valid: boolean; brokenAtId: string | null }> {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { id: 'desc' }, take: limit });
    rows.reverse();

    let previous: string | null = rows[0]?.prevHash ?? null; // oldest row's anchor is trusted
    for (const row of rows) {
      const expected = AuditService.computeHash({
        prevHash: previous,
        occurredAt: row.occurredAt.toISOString(),
        event: row.event,
        outcome: row.outcome,
        actorId: row.actorId,
        targetType: row.targetType,
        targetId: row.targetId,
        ip: row.ip,
        requestId: row.requestId,
        metadata: row.metadata ?? null,
      });
      if (row.prevHash !== previous || row.hash !== expected) {
        return { checked: rows.length, valid: false, brokenAtId: row.id.toString() };
      }
      previous = row.hash;
    }
    return { checked: rows.length, valid: true, brokenAtId: null };
  }

  async list(params: { limit: number; beforeId?: string; event?: string; actorId?: string }) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        ...(params.event ? { event: params.event } : {}),
        ...(params.actorId ? { actorId: params.actorId } : {}),
        ...(params.beforeId ? { id: { lt: BigInt(params.beforeId) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: params.limit + 1,
    });
    const hasMore = rows.length > params.limit;
    return { items: rows.slice(0, params.limit), nextCursor: hasMore ? rows[params.limit - 1]!.id.toString() : null };
  }

  async listForClient(clientId: string, params: { limit: number; beforeId?: string }) {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        targetType: 'client',
        targetId: clientId,
        ...(params.beforeId ? { id: { lt: BigInt(params.beforeId) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: params.limit + 1,
    });
    const hasMore = rows.length > params.limit;
    return { items: rows.slice(0, params.limit), nextCursor: hasMore ? rows[params.limit - 1]!.id.toString() : null };
  }

  async dailyClientEventCounts(clientId: string, days: number) {
    const since = new Date(Date.now() - days * 86_400_000);
    const rows = await this.prisma.$queryRaw<Array<{ day: Date; event: string; count: bigint }>>`
      SELECT date_trunc('day', "occurredAt") AS day, event, COUNT(*)::bigint AS count
      FROM audit_logs
      WHERE "targetType" = 'client' AND "targetId" = ${clientId} AND "occurredAt" >= ${since}
      GROUP BY 1, 2
      ORDER BY 1 ASC`;
    return rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), event: r.event, count: Number(r.count) }));
  }

  /** Retention job: keeps the chain verifiable because the oldest remaining row re-anchors it. */
  async pruneOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000);
    const { count } = await this.prisma.auditLog.deleteMany({ where: { occurredAt: { lt: cutoff } } });
    return count;
  }
}

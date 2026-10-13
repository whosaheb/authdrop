import { type AuditLog } from '../../generated/prisma/client.js';
import { type AuditEntryResponseDto } from './dto/audit.dto.js';

export function toAuditEntryDto(row: AuditLog): AuditEntryResponseDto {
  return {
    id: row.id.toString(),
    occurredAt: row.occurredAt.toISOString(),
    event: row.event,
    outcome: row.outcome,
    actorId: row.actorId,
    targetType: row.targetType,
    targetId: row.targetId,
    ip: row.ip,
    requestId: row.requestId,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
  };
}

import { Controller, Get, Query } from '@nestjs/common';
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { AuditService } from './audit.service.js';
import { toAuditEntryDto } from './audit.mapper.js';
import { AuditPageResponseDto, AuditQueryDto, AuditVerifyResponseDto } from './dto/audit.dto.js';

@ApiTags('Admin / Audit')
@ApiCookieAuth('authdrop_session')
@Roles('ADMIN')
@Controller('admin/audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @ApiOperation({ summary: 'Browse the audit trail (admin only)' })
  @ApiOkResponse({ type: AuditPageResponseDto })
  async list(@Query() query: AuditQueryDto): Promise<AuditPageResponseDto> {
    const page = await this.audit.list({ limit: query.limit, beforeId: query.cursor, event: query.event, actorId: query.actorId });
    return { items: page.items.map(toAuditEntryDto), nextCursor: page.nextCursor };
  }

  @Get('verify')
  @ApiOperation({ summary: 'Verify the tamper-evident hash chain of recent audit entries' })
  @ApiOkResponse({ type: AuditVerifyResponseDto })
  verify(): Promise<AuditVerifyResponseDto> {
    return this.audit.verifyChain();
  }
}

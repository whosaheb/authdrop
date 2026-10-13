import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller.js';
import { AuditService } from './audit.service.js';
import { RetentionService } from './retention.service.js';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, RetentionService],
  exports: [AuditService],
})
export class AuditModule {}

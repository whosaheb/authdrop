import { Global, Module } from '@nestjs/common';
import { MfaController } from './mfa.controller.js';
import { MfaService } from './mfa.service.js';

@Global()
@Module({
  controllers: [MfaController],
  providers: [MfaService],
  exports: [MfaService],
})
export class MfaModule {}

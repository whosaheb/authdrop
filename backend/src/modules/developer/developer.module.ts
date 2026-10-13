import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service.js';
import { DeveloperController } from './developer.controller.js';
import { OidcModule } from '../oidc/oidc.module.js';

@Module({
  imports: [OidcModule],
  controllers: [DeveloperController],
  providers: [ClientsService],
  exports: [ClientsService],
})
export class DeveloperModule {}

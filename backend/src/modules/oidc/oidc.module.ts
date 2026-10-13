import { Module } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service.js';
import { CryptoService } from '../../common/crypto/crypto.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { RedisService } from '../../infrastructure/redis/redis.service.js';
import { AuditService } from '../audit/audit.service.js';
import { SessionService } from '../auth-core/session.service.js';
import { ConnectedAppsService } from './connected-apps.service.js';
import { ConsentService } from './consent.service.js';
import { InteractionService } from './interaction.service.js';
import { OidcController } from './oidc.controller.js';
import { OIDC_PROVIDER } from './oidc.constants.js';
import { createOidcProvider } from './oidc-provider.factory.js';
import { OidcSessionService } from './oidc-session.service.js';

@Module({
  controllers: [OidcController],
  providers: [
    ConsentService,
    {
      provide: OIDC_PROVIDER,
      inject: [AppConfig, PrismaService, RedisService, CryptoService, AuditService, ConsentService, SessionService],
      useFactory: (
        config: AppConfig,
        prisma: PrismaService,
        redis: RedisService,
        crypto: CryptoService,
        audit: AuditService,
        consent: ConsentService,
        sessions: SessionService,
      ) => createOidcProvider({ config, prisma, redis, crypto, audit, consent, sessions }),
    },
    InteractionService,
    OidcSessionService,
    ConnectedAppsService,
  ],
  exports: [OIDC_PROVIDER, InteractionService, OidcSessionService, ConnectedAppsService, ConsentService],
})
export class OidcModule {}

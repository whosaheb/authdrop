import { Module, ValidationPipe } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';
import { OriginGuard } from './common/guards/origin.guard.js';
import { RateLimitGuard } from './common/guards/rate-limit.guard.js';
import { RolesGuard } from './common/guards/roles.guard.js';
import { SessionGuard } from './common/guards/session.guard.js';
import { CryptoModule } from './common/crypto/crypto.module.js';
import { ConfigModule } from './config/config.module.js';
import { MailModule } from './infrastructure/mail/mail.module.js';
import { PrismaModule } from './infrastructure/prisma/prisma.module.js';
import { RedisModule } from './infrastructure/redis/redis.module.js';
import { StorageModule } from './infrastructure/storage/storage.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthCoreModule } from './modules/auth-core/auth-core.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { DeveloperModule } from './modules/developer/developer.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { MfaModule } from './modules/mfa/mfa.module.js';
import { OidcModule } from './modules/oidc/oidc.module.js';
import { SessionsModule } from './modules/sessions/sessions.module.js';
import { UsersModule } from './modules/users/users.module.js';

@Module({
  imports: [
    // infrastructure (global)
    ConfigModule,
    CryptoModule,
    PrismaModule,
    RedisModule,
    MailModule,
    StorageModule,
    // cross-cutting
    AuthCoreModule,
    AuditModule,
    // features
    UsersModule,
    MfaModule,
    OidcModule,
    AuthModule,
    SessionsModule,
    DeveloperModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true, // strip unknown properties
        forbidNonWhitelisted: true, // ...and reject the request instead of silently ignoring them
        transform: true,
        transformOptions: { enableImplicitConversion: false },
        stopAtFirstError: true,
      }),
    },
    // Order matters: CSRF/origin → authentication → authorisation → rate limiting (needs the resolved user).
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
  ],
})
export class AppModule {}

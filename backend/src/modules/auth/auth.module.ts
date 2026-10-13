import { Module } from '@nestjs/common';
import { SocialModule } from '../social/social.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { SocialAuthController } from './social-auth.controller.js';
import { OidcModule } from '../oidc/oidc.module.js';

@Module({
  imports: [SocialModule, OidcModule],
  controllers: [AuthController, SocialAuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}

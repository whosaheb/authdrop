import { Global, Module } from '@nestjs/common';
import { CookieService } from './cookie.service.js';
import { OtpService } from './otp.service.js';
import { PreauthService } from './preauth.service.js';
import { SessionService } from './session.service.js';

/** Low-level authentication primitives shared by guards and feature modules. */
@Global()
@Module({
  providers: [SessionService, PreauthService, OtpService, CookieService],
  exports: [SessionService, PreauthService, OtpService, CookieService],
})
export class AuthCoreModule {}

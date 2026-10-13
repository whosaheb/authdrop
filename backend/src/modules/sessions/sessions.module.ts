import { Module } from '@nestjs/common';
import { SessionsController } from './sessions.controller.js';
import { OidcModule } from '../oidc/oidc.module.js';

@Module({ imports: [OidcModule], controllers: [SessionsController] })
export class SessionsModule {}

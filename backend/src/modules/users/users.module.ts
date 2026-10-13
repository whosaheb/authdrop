import { Global, Module } from '@nestjs/common';
import { UsersController } from './users.controller.js';
import { UsersService } from './users.service.js';
import { OidcModule } from '../oidc/oidc.module.js';

@Global()
@Module({
  imports: [OidcModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}

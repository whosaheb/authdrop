import { Body, Controller, Get, HttpCode, Post, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type FastifyRequest } from 'fastify';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { getRequestMeta } from '../../common/helpers/request.helper.js';
import { type AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { UsersService } from '../users/users.service.js';
import { BackupCodesResponseDto, MfaStatusResponseDto, SecondFactorDto, TotpCodeDto, TotpSetupResponseDto } from './dto/mfa.dto.js';
import { MfaService } from './mfa.service.js';

@ApiTags('MFA')
@ApiCookieAuth('authdrop_session')
@Controller('mfa')
export class MfaController {
  constructor(
    private readonly mfa: MfaService,
    private readonly users: UsersService,
  ) {}

  private async loadUser(current: AuthenticatedUser) {
    return (await this.users.findActiveById(current.id))!;
  }

  @Get('status')
  @ApiOperation({ summary: 'Is the authenticator app enabled, and how many recovery codes are left?' })
  @ApiOkResponse({ type: MfaStatusResponseDto })
  async status(@CurrentUser() current: AuthenticatedUser): Promise<MfaStatusResponseDto> {
    return this.mfa.status(await this.loadUser(current));
  }

  @Post('totp/setup')
  @HttpCode(200)
  @RateLimit({ name: 'mfa-setup', limit: 10, windowSeconds: 3600, by: ['user'] })
  @ApiOperation({ summary: 'Start enrolment: returns the secret and a QR code to scan' })
  @ApiOkResponse({ type: TotpSetupResponseDto })
  async setup(@CurrentUser() current: AuthenticatedUser): Promise<TotpSetupResponseDto> {
    return this.mfa.beginSetup(await this.loadUser(current));
  }

  @Post('totp/enable')
  @HttpCode(200)
  @RateLimit({ name: 'mfa-confirm', limit: 10, windowSeconds: 600, by: ['user'] })
  @ApiOperation({ summary: 'Confirm enrolment with a 6-digit code; returns the one-time recovery codes' })
  @ApiOkResponse({ type: BackupCodesResponseDto })
  async enable(@CurrentUser() current: AuthenticatedUser, @Body() dto: TotpCodeDto, @Req() request: FastifyRequest): Promise<BackupCodesResponseDto> {
    return { codes: await this.mfa.confirmSetup(await this.loadUser(current), dto.code, getRequestMeta(request)) };
  }

  @Post('totp/disable')
  @HttpCode(204)
  @RateLimit({ name: 'mfa-disable', limit: 10, windowSeconds: 600, by: ['user'] })
  @ApiOperation({ summary: 'Disable the authenticator app (requires a current authenticator code)' })
  @ApiNoContentResponse()
  async disable(@CurrentUser() current: AuthenticatedUser, @Body() dto: SecondFactorDto, @Req() request: FastifyRequest): Promise<void> {
    await this.mfa.disable(await this.loadUser(current), dto, getRequestMeta(request));
  }

  @Post('backup-codes/regenerate')
  @HttpCode(200)
  @RateLimit({ name: 'mfa-backup-regen', limit: 10, windowSeconds: 600, by: ['user'] })
  @ApiOperation({ summary: 'Replace all recovery codes (requires a current authenticator code). Old codes stop working.' })
  @ApiOkResponse({ type: BackupCodesResponseDto })
  async regenerate(@CurrentUser() current: AuthenticatedUser, @Body() dto: SecondFactorDto, @Req() request: FastifyRequest): Promise<BackupCodesResponseDto> {
    return { codes: await this.mfa.regenerateBackupCodes(await this.loadUser(current), dto, getRequestMeta(request)) };
  }
}

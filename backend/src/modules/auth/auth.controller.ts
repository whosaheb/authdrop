import { Body, Controller, Get, HttpCode, Param, Post, Req, Res } from '@nestjs/common';
import { ApiAcceptedResponse, ApiCookieAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { INTERACTION_COOKIE, PREAUTH_COOKIE, SESSION_COOKIE } from '../../common/constants/cookies.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { getRequestMeta } from '../../common/helpers/request.helper.js';
import { MessageResponseDto } from '../../common/dto/message-response.dto.js';
import { type AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { SocialService } from '../social/social.service.js';
import { StorageService } from '../../infrastructure/storage/storage.service.js';
import { toUserDto } from '../users/users.mapper.js';
import { UsersService } from '../users/users.service.js';
import {
  AuthStepResponseDto,
  ConsentDecisionDto,
  InteractionDetailsResponseDto,
  InteractionResultResponseDto,
  MfaVerifyDto,
  OtpRequestDto,
  OtpVerifyDto,
  RegisterProfileDto,
  SessionStateResponseDto,
} from './dto/auth.dto.js';
import { AuthService, type FlowContext } from './auth.service.js';

const OIDC_SESSION_COOKIE = '_session';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly social: SocialService,
    private readonly storage: StorageService,
  ) {}

  private context(request: FastifyRequest, reply: FastifyReply): FlowContext {
    return {
      meta: getRequestMeta(request),
      reply,
      interactionCookie: request.cookies?.[INTERACTION_COOKIE],
      previousSessionId: request.cookies?.[SESSION_COOKIE],
    };
  }

  @Public()
  @Get('session')
  @ApiOperation({ summary: 'Who am I? Also reports a half-finished sign-in and the enabled social providers' })
  @ApiOkResponse({ type: SessionStateResponseDto })
  async session(@Req() request: FastifyRequest): Promise<SessionStateResponseDto> {
    const providers = this.social.listEnabled();
    const preauth = await this.auth.describePreauth(request.cookies?.[PREAUTH_COOKIE]);
    if (!request.authUser) return { authenticated: false, preauth, providers };
    const user = await this.users.getWithSocial(request.authUser.id);
    return { authenticated: true, user: toUserDto(user!, this.storage.enabled), preauth, providers };
  }

  @Public()
  @Post('otp/request')
  @HttpCode(202)
  @RateLimit(
    { name: 'otp-request', limit: 5, windowSeconds: 3600, by: ['email'] },
    { name: 'otp-request-ip', limit: 30, windowSeconds: 3600, by: ['ip'] },
  )
  @ApiOperation({
    summary: 'Send a 6-digit sign-in / sign-up code to an e-mail address',
    description: 'Identical response whether or not the address is registered (no account enumeration).',
  })
  @ApiAcceptedResponse({ type: MessageResponseDto })
  async requestOtp(@Body() dto: OtpRequestDto, @Req() request: FastifyRequest): Promise<MessageResponseDto> {
    await this.auth.requestOtp(dto.email, getRequestMeta(request));
    return new MessageResponseDto('If the address can be used, a code is on its way.');
  }

  @Public()
  @Post('otp/verify')
  @HttpCode(200)
  @RateLimit({ name: 'otp-verify', limit: 20, windowSeconds: 600, by: ['email', 'ip'] })
  @ApiOperation({ summary: 'Verify the e-mail code. Existing user → signed in (or MFA); new user → profile step' })
  @ApiOkResponse({ type: AuthStepResponseDto })
  verifyOtp(@Body() dto: OtpVerifyDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<AuthStepResponseDto> {
    return this.auth.verifyOtp(dto.email, dto.code, dto.uid, this.context(request, reply));
  }

  @Public()
  @Post('mfa/verify')
  @HttpCode(200)
  @RateLimit({ name: 'mfa-verify', limit: 20, windowSeconds: 600, by: ['ip'] })
  @ApiOperation({ summary: 'Second step: authenticator code or single-use backup code' })
  @ApiOkResponse({ type: AuthStepResponseDto })
  verifyMfa(@Body() dto: MfaVerifyDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<AuthStepResponseDto> {
    return this.auth.verifyMfa(request.cookies?.[PREAUTH_COOKIE], dto, this.context(request, reply));
  }

  @Public()
  @Post('register/profile')
  @HttpCode(201)
  @RateLimit({ name: 'register', limit: 10, windowSeconds: 600, by: ['ip'] })
  @ApiOperation({ summary: 'Create the account for a verified e-mail (first and last name)' })
  @ApiCreatedResponse({ type: AuthStepResponseDto })
  registerProfile(@Body() dto: RegisterProfileDto, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<AuthStepResponseDto> {
    return this.auth.registerProfile(request.cookies?.[PREAUTH_COOKIE], dto, this.context(request, reply));
  }

  @Post('register/complete')
  @HttpCode(200)
  @ApiCookieAuth('authdrop_session')
  @ApiOperation({ summary: 'Finish the sign-up wizard (after optional MFA setup / skip) and continue to the destination' })
  @ApiOkResponse({ type: AuthStepResponseDto })
  completeRegistration(@CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<AuthStepResponseDto> {
    return this.auth.completeRegistration(request.cookies?.[PREAUTH_COOKIE], current.id, this.context(request, reply));
  }

  @Public()
  @Post('logout')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign out of this browser (portal session and SSO session)' })
  @ApiNoContentResponse()
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    await this.auth.logout(request.cookies?.[SESSION_COOKIE], request.cookies?.[OIDC_SESSION_COOKIE], this.context(request, reply));
  }

  // ───── OIDC interaction bridge: the "interactive OIDC loop" ─────

  @Public()
  @Get('interactions/:uid')
  @ApiOperation({ summary: 'Describe a paused /authorize request (which app, which scopes)' })
  @ApiParam({ name: 'uid', description: 'Interaction id from /login?uid=...' })
  @ApiOkResponse({ type: InteractionDetailsResponseDto })
  interaction(@Param('uid') uid: string, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<InteractionDetailsResponseDto> {
    return this.auth.getInteraction(uid, this.context(request, reply));
  }

  @Post('interactions/:uid/continue')
  @HttpCode(200)
  @ApiCookieAuth('authdrop_session')
  @ApiOperation({ summary: 'SSO: complete the paused login with the existing portal session' })
  @ApiOkResponse({ type: InteractionResultResponseDto })
  continueInteraction(@Param('uid') uid: string, @CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<InteractionResultResponseDto> {
    return this.auth.continueInteraction(uid, current, this.context(request, reply));
  }

  @Post('interactions/:uid/consent')
  @HttpCode(200)
  @ApiCookieAuth('authdrop_session')
  @ApiOperation({ summary: 'Allow or deny an application that the user previously revoked' })
  @ApiOkResponse({ type: InteractionResultResponseDto })
  consent(@Param('uid') uid: string, @Body() dto: ConsentDecisionDto, @CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<InteractionResultResponseDto> {
    return this.auth.decideConsent(uid, current.id, dto.approve, this.context(request, reply));
  }
}

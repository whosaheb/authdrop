import { Controller, Get, Logger, Param, Query, Req, Res } from '@nestjs/common';
import { ApiFoundResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { INTERACTION_COOKIE, OAUTH_STATE_COOKIE, SESSION_COOKIE } from '../../common/constants/cookies.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { getRequestMeta } from '../../common/helpers/request.helper.js';
import { AuditService } from '../audit/audit.service.js';
import { CookieService } from '../auth-core/cookie.service.js';
import { SocialAuthError } from '../social/social.errors.js';
import { SocialService } from '../social/social.service.js';
import { AuthService, type FlowContext } from './auth.service.js';

const UID_PATTERN = /^[\w-]{10,64}$/;
const ERROR_CODES: Record<SocialAuthError['reason'], string> = {
  denied: 'social_denied',
  unverified_email: 'social_unverified',
  invalid_state: 'social_failed',
  upstream: 'social_failed',
  disabled: 'social_failed',
};

/** Browser-navigated endpoints (redirects), so they answer with 302 instead of JSON. */
@ApiTags('Social login')
@Controller('auth/social')
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(
    private readonly social: SocialService,
    private readonly auth: AuthService,
    private readonly cookies: CookieService,
    private readonly audit: AuditService,
  ) {}

  @Public()
  @Get(':provider/start')
  @RateLimit({ name: 'social-start', limit: 30, windowSeconds: 600, by: ['ip'] })
  @ApiOperation({ summary: 'Start social sign-in. Redirects the browser to the provider.' })
  @ApiParam({ name: 'provider', enum: ['google', 'github', 'facebook', 'linkedin'] })
  @ApiQuery({ name: 'uid', required: false, description: 'OIDC interaction id when started by an application' })
  @ApiFoundResponse({ description: 'Redirect to the identity provider' })
  async start(@Param('provider') provider: string, @Query('uid') uid: string | undefined, @Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const safeUid = uid && UID_PATTERN.test(uid) && request.cookies?.[INTERACTION_COOKIE] === uid ? uid : undefined;
    const { redirectUrl, state } = await this.social.begin(provider, safeUid);
    this.cookies.setOauthState(reply, state);
    return reply.redirect(redirectUrl, 302);
  }

  @Public()
  @Get(':provider/callback')
  @RateLimit({ name: 'social-callback', limit: 30, windowSeconds: 600, by: ['ip'] })
  @ApiOperation({ summary: 'OAuth redirect URI registered at the provider. Not called by API clients.' })
  @ApiParam({ name: 'provider', enum: ['google', 'github', 'facebook', 'linkedin'] })
  @ApiFoundResponse({ description: 'Redirect back into the portal' })
  async callback(
    @Param('provider') provider: string,
    @Query('code') code: string | undefined,
    @Query('state') state: string | undefined,
    @Query('error') upstreamError: string | undefined,
    @Req() request: FastifyRequest,
    @Res() reply: FastifyReply,
  ): Promise<void> {
    const meta = getRequestMeta(request);
    const ctx: FlowContext = {
      meta,
      reply,
      interactionCookie: request.cookies?.[INTERACTION_COOKIE],
      previousSessionId: request.cookies?.[SESSION_COOKIE],
    };
    let target: string;
    let uid: string | undefined;

    try {
      if (upstreamError) throw new SocialAuthError(`provider returned error: ${upstreamError.slice(0, 40)}`, 'denied');
      if (!code || !state) throw new SocialAuthError('missing code or state', 'invalid_state');
      const result = await this.social.complete(provider, { code, state, cookieState: request.cookies?.[OAUTH_STATE_COOKIE] });
      uid = result.uid;
      target = await this.auth.handleSocialIdentity(result.identity, result.uid, ctx);
    } catch (error) {
      const reason = error instanceof SocialAuthError ? error.reason : 'upstream';
      if (!(error instanceof SocialAuthError)) this.logger.error({ msg: 'Social callback crashed', provider, err: String(error) });
      await this.audit.record({
        event: AuditEvent.SocialLoginFailed,
        outcome: 'FAILURE',
        metadata: { provider, reason, detail: error instanceof SocialAuthError ? error.message : 'internal' },
        ...meta,
      });
      target = `/login?error=${ERROR_CODES[reason]}${uid ? `&uid=${encodeURIComponent(uid)}` : ''}`;
    }

    this.cookies.clearOauthState(reply);
    return reply.redirect(target, 302);
  }
}

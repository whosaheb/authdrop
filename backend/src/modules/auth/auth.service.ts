import { BadRequestException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { type FastifyReply } from 'fastify';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { type RequestMeta } from '../../common/helpers/request.helper.js';
import { maskEmail } from '../../common/helpers/email.helper.js';
import { type User } from '../../generated/prisma/client.js';
import { MailService } from '../../infrastructure/mail/mail.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CookieService } from '../auth-core/cookie.service.js';
import { OtpService } from '../auth-core/otp.service.js';
import { PreauthService, type SocialLink } from '../auth-core/preauth.service.js';
import { SessionService } from '../auth-core/session.service.js';
import { MfaService } from '../mfa/mfa.service.js';
import { InteractionService } from '../oidc/interaction.service.js';
import { OidcSessionService } from '../oidc/oidc-session.service.js';
import { type SocialIdentity } from '../social/social.types.js';
import { UsersService } from '../users/users.service.js';
import {
  type AuthStepResponseDto,
  type InteractionDetailsResponseDto,
  type InteractionResultResponseDto,
  type MfaVerifyDto,
  type PreauthStateDto,
  type RegisterProfileDto,
} from './dto/auth.dto.js';

const DEFAULT_LANDING = '/account/settings';
const GENERIC_CODE_ERROR = 'That code is invalid or has expired. Request a new one.';

/** Request-scoped inputs every flow needs. */
export interface FlowContext {
  meta: RequestMeta;
  reply: FastifyReply;
  /** Value of the authdrop_interaction cookie (binds `uid` to this browser). */
  interactionCookie?: string;
  /** Existing portal session cookie, destroyed on login to prevent session fixation. */
  previousSessionId?: string;
}

/**
 * The passwordless login state machine:
 *
 *   e-mail OTP  ─┐
 *                ├─► first factor proven ─► (TOTP/backup code if enabled) ─► session ─► resume OIDC interaction
 *   social login ┘                        └► (no account yet) ─► profile ─► optional MFA wizard ─► complete
 *
 * Social login is only another way to prove a *verified e-mail address*; everything after that is shared.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly otp: OtpService,
    private readonly mail: MailService,
    private readonly sessions: SessionService,
    private readonly preauth: PreauthService,
    private readonly cookies: CookieService,
    private readonly mfa: MfaService,
    private readonly interactions: InteractionService,
    private readonly oidcSessions: OidcSessionService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ───────────────────────── e-mail OTP ─────────────────────────

  /** Always succeeds from the caller's point of view, so it cannot be used to discover registered addresses. */
  async requestOtp(email: string, meta: RequestMeta): Promise<void> {
    const user = await this.users.findByEmail(email);
    if (user && user.status !== 'ACTIVE') {
      await this.audit.record({ event: AuditEvent.LoginBlocked, outcome: 'FAILURE', actorId: user.id, metadata: { reason: 'suspended' }, ...meta });
      return;
    }
    const code = await this.otp.issue(email);
    await this.mail.sendOtp(email, code, user ? 'login' : 'register');
    await this.audit.record({ event: AuditEvent.OtpRequested, actorId: user?.id ?? null, metadata: { purpose: user ? 'login' : 'register', email: maskEmail(email) }, ...meta });
  }

  async verifyOtp(email: string, code: string, uid: string | undefined, ctx: FlowContext): Promise<AuthStepResponseDto> {
    this.assertBound(uid, ctx);
    const result = await this.otp.verify(email, code);
    if (result !== 'valid') {
      await this.audit.record({ event: AuditEvent.OtpVerifyFailed, outcome: 'FAILURE', metadata: { email: maskEmail(email), result }, ...ctx.meta });
      throw new UnauthorizedException(result === 'locked' ? 'Too many incorrect attempts. Request a new code.' : GENERIC_CODE_ERROR);
    }

    const user = await this.users.findByEmail(email);
    if (user) {
      if (user.status !== 'ACTIVE') {
        await this.audit.record({ event: AuditEvent.LoginBlocked, outcome: 'FAILURE', actorId: user.id, metadata: { reason: 'suspended' }, ...ctx.meta });
        throw new UnauthorizedException(GENERIC_CODE_ERROR);
      }
      await this.users.markEmailVerified(user.id);
      return this.afterFirstFactor(user, ['otp'], uid, undefined, ctx);
    }

    await this.startRegistration({ email, uid, amr: ['otp'] }, ctx);
    return { status: 'profile_required', redirectTo: null };
  }

  // ───────────────────────── second factor ─────────────────────────

  async verifyMfa(token: string | undefined, dto: MfaVerifyDto, ctx: FlowContext): Promise<AuthStepResponseDto> {
    const ticket = await this.preauth.get(token);
    if (!token || !ticket || ticket.kind !== 'mfa') throw new UnauthorizedException('Your sign-in expired. Please start again.');
    const user = await this.users.findActiveById(ticket.userId);
    if (!user) throw new UnauthorizedException('Your sign-in expired. Please start again.');

    const ok = await this.mfa.verifySecondFactor(user, dto, ctx.meta);
    if (!ok) {
      const burned = await this.preauth.registerFailure(token);
      if (burned) this.cookies.clearPreauth(ctx.reply);
      throw new UnauthorizedException(burned ? 'Too many incorrect attempts. Please sign in again.' : 'That code is not valid.');
    }
    return this.finalizeLogin(user, [...ticket.amr, 'mfa'], ticket.uid, ticket.social, ctx, token);
  }

  // ───────────────────────── registration ─────────────────────────

  async registerProfile(token: string | undefined, dto: RegisterProfileDto, ctx: FlowContext): Promise<AuthStepResponseDto> {
    const ticket = await this.preauth.get(token);
    if (!token || !ticket || ticket.kind !== 'registration') throw new UnauthorizedException('Your sign-up expired. Please start again.');

    const user = await this.users.create({ email: ticket.email, firstName: dto.firstName, lastName: dto.lastName, social: ticket.social });
    await this.audit.record({ event: AuditEvent.UserRegistered, actorId: user.id, targetType: 'user', targetId: user.id, metadata: { via: ticket.amr[0] }, ...ctx.meta });
    if (ticket.social) {
      await this.audit.record({ event: AuditEvent.SocialLinked, actorId: user.id, targetType: 'user', targetId: user.id, metadata: { provider: ticket.social.provider }, ...ctx.meta });
    }

    await this.openSession(user, ticket.amr, ctx);
    await this.preauth.replace(token, { kind: 'registered', userId: user.id, uid: ticket.uid, amr: ticket.amr });
    return { status: 'profile_created', redirectTo: null };
  }

  /** Last step of the sign-up wizard (after the optional MFA setup): resumes the app that started the flow. */
  async completeRegistration(token: string | undefined, userId: string, ctx: FlowContext): Promise<AuthStepResponseDto> {
    const ticket = await this.preauth.get(token);
    if (!token || !ticket || ticket.kind !== 'registered' || ticket.userId !== userId) {
      return { status: 'authenticated', redirectTo: DEFAULT_LANDING }; // nothing pending: just land in the portal
    }
    await this.preauth.consume(token);
    this.cookies.clearPreauth(ctx.reply);
    return { status: 'authenticated', redirectTo: await this.resolveRedirect(ticket.uid, userId, ticket.amr) };
  }

  // ───────────────────────── social ─────────────────────────

  /** Returns the portal path (or absolute OIDC resume URL) the browser must be redirected to. */
  async handleSocialIdentity(identity: SocialIdentity, uid: string | undefined, ctx: FlowContext): Promise<string> {
    const link: SocialLink = { provider: identity.provider, providerUserId: identity.providerUserId };
    const amr = [`social:${identity.provider}`];

    let user = await this.users.findBySocial(link);
    let pendingLink: SocialLink | undefined;
    if (!user) {
      // Verified e-mail (enforced by SocialService) == same person: attach the provider to the existing account.
      user = await this.users.findByEmail(identity.email);
      if (user) pendingLink = link;
    }

    if (user) {
      if (user.status !== 'ACTIVE') {
        await this.audit.record({ event: AuditEvent.LoginBlocked, outcome: 'FAILURE', actorId: user.id, metadata: { reason: 'suspended', provider: identity.provider }, ...ctx.meta });
        return this.withUid('/login?error=account_unavailable', uid);
      }
      await this.users.markEmailVerified(user.id);
      const step = await this.afterFirstFactor(user, amr, uid, pendingLink, ctx);
      return step.status === 'authenticated' ? step.redirectTo! : this.withUid('/login?step=mfa', uid);
    }

    await this.startRegistration(
      { email: identity.email, uid, amr, social: link, prefill: { firstName: identity.firstName, lastName: identity.lastName } },
      ctx,
    );
    return this.withUid('/register/profile', uid);
  }

  // ───────────────────────── sessions ─────────────────────────

  async logout(sessionId: string | undefined, oidcSessionId: string | undefined, ctx: FlowContext): Promise<void> {
    if (sessionId) {
      const session = await this.sessions.get(sessionId);
      await this.sessions.destroy(sessionId);
      if (session) {
        await this.oidcSessions.endBrowserSession(oidcSessionId, session.userId);
        await this.audit.record({ event: AuditEvent.Logout, actorId: session.userId, ...ctx.meta });
      }
    }
    this.cookies.clearSession(ctx.reply);
    this.cookies.clearPreauth(ctx.reply);
  }

  async describePreauth(token: string | undefined): Promise<PreauthStateDto | undefined> {
    const ticket = await this.preauth.get(token);
    if (!ticket) return undefined;
    if (ticket.kind === 'registration') {
      return { step: 'profile', maskedEmail: maskEmail(ticket.email), firstName: ticket.prefill?.firstName, lastName: ticket.prefill?.lastName };
    }
    return { step: ticket.kind === 'mfa' ? 'mfa' : 'security_setup' };
  }

  // ───────────────────────── OIDC interaction bridge ─────────────────────────

  async getInteraction(uid: string, ctx: FlowContext): Promise<InteractionDetailsResponseDto> {
    this.assertBound(uid, ctx);
    const details = await this.interactions.find(uid);
    if (!details) throw new NotFoundException('This sign-in request has expired. Return to the application and try again.');
    const client = await this.prisma.client.findUnique({ where: { clientId: details.clientId }, select: { name: true } });
    return {
      uid,
      prompt: details.promptName,
      clientName: client?.name ?? details.clientId,
      scopes: details.scopes,
      forceReauth: details.forceReauth,
    };
  }

  /** The browser already has a portal session (SSO): finish the app's login without asking again. */
  async continueInteraction(uid: string, user: { id: string; sessionId: string }, ctx: FlowContext): Promise<InteractionResultResponseDto> {
    this.assertBound(uid, ctx);
    const details = await this.interactions.find(uid);
    if (!details) throw new NotFoundException('This sign-in request has expired. Return to the application and try again.');
    if (details.forceReauth) throw new ForbiddenException('The application requires you to sign in again');
    if (details.promptName === 'consent') return { status: 'consent_required', redirectTo: null };

    const session = await this.sessions.get(user.sessionId);
    const redirectTo = await this.interactions.completeLogin(uid, user.id, session?.amr ?? ['sso']);
    if (!redirectTo) throw new NotFoundException('This sign-in request has expired. Return to the application and try again.');
    return { status: 'redirect', redirectTo };
  }

  async decideConsent(uid: string, userId: string, approve: boolean, ctx: FlowContext): Promise<InteractionResultResponseDto> {
    this.assertBound(uid, ctx);
    const details = await this.interactions.find(uid);
    if (!details) throw new NotFoundException('This sign-in request has expired. Return to the application and try again.');
    if (details.promptName !== 'consent') throw new BadRequestException('No consent is pending for this request');

    const redirectTo = await this.interactions.completeConsent(uid, userId, approve);
    if (!redirectTo) throw new NotFoundException('This sign-in request has expired. Return to the application and try again.');
    if (approve) {
      await this.audit.record({ event: AuditEvent.AppConsentGranted, actorId: userId, targetType: 'client', targetId: details.clientId, ...ctx.meta });
    }
    return { status: 'redirect', redirectTo };
  }

  // ───────────────────────── internals ─────────────────────────

  private async afterFirstFactor(user: User, amr: string[], uid: string | undefined, social: SocialLink | undefined, ctx: FlowContext): Promise<AuthStepResponseDto> {
    if (user.totpEnabled) {
      const token = await this.preauth.create({ kind: 'mfa', userId: user.id, uid, amr, social });
      this.cookies.setPreauth(ctx.reply, token);
      return { status: 'mfa_required', redirectTo: null };
    }
    return this.finalizeLogin(user, amr, uid, social, ctx);
  }

  private async startRegistration(
    input: { email: string; uid?: string; amr: string[]; social?: SocialLink; prefill?: { firstName?: string; lastName?: string } },
    ctx: FlowContext,
  ): Promise<void> {
    const token = await this.preauth.create({ kind: 'registration', ...input });
    this.cookies.setPreauth(ctx.reply, token);
  }

  private async finalizeLogin(user: User, amr: string[], uid: string | undefined, social: SocialLink | undefined, ctx: FlowContext, preauthToken?: string): Promise<AuthStepResponseDto> {
    if (social && (await this.users.linkSocial(user.id, social, user.email))) {
      await this.audit.record({ event: AuditEvent.SocialLinked, actorId: user.id, targetType: 'user', targetId: user.id, metadata: { provider: social.provider }, ...ctx.meta });
    }
    await this.users.markLogin(user.id);
    await this.openSession(user, amr, ctx);
    if (preauthToken) {
      await this.preauth.consume(preauthToken);
      this.cookies.clearPreauth(ctx.reply);
    }
    return { status: 'authenticated', redirectTo: await this.resolveRedirect(uid, user.id, amr) };
  }

  private async openSession(user: User, amr: string[], ctx: FlowContext): Promise<void> {
    if (ctx.previousSessionId) await this.sessions.destroy(ctx.previousSessionId); // fresh id on every login (fixation defence)
    const sessionId = await this.sessions.create(user.id, ctx.meta, amr);
    this.cookies.setSession(ctx.reply, sessionId);
    await this.audit.record({ event: AuditEvent.LoginSuccess, actorId: user.id, targetType: 'user', targetId: user.id, metadata: { amr }, ...ctx.meta });
  }

  private async resolveRedirect(uid: string | undefined, userId: string, amr: string[]): Promise<string> {
    if (!uid) return DEFAULT_LANDING;
    return (await this.interactions.completeLogin(uid, userId, amr)) ?? DEFAULT_LANDING;
  }

  private withUid(path: string, uid?: string): string {
    if (!uid) return path;
    return `${path}${path.includes('?') ? '&' : '?'}uid=${encodeURIComponent(uid)}`;
  }

  private assertBound(uid: string | undefined, ctx: FlowContext): void {
    if (uid && ctx.interactionCookie !== uid) {
      throw new ForbiddenException('This sign-in request does not belong to this browser. Return to the application and try again.');
    }
  }
}

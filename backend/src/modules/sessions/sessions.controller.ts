import { Controller, Delete, Get, HttpCode, NotFoundException, Param, Post, Req, Res } from '@nestjs/common';
import { ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { getRequestMeta } from '../../common/helpers/request.helper.js';
import { type AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { AuditService } from '../audit/audit.service.js';
import { CookieService } from '../auth-core/cookie.service.js';
import { SessionService } from '../auth-core/session.service.js';
import { ConnectedAppsService } from '../oidc/connected-apps.service.js';
import { OidcSessionService } from '../oidc/oidc-session.service.js';
import { ConnectedAppResponseDto, PortalSessionResponseDto, RevokedCountResponseDto } from './dto/sessions.dto.js';

@ApiTags('Sessions & connected apps')
@ApiCookieAuth('authdrop_session')
@Controller('account')
export class SessionsController {
  constructor(
    private readonly sessions: SessionService,
    private readonly oidcSessions: OidcSessionService,
    private readonly connectedApps: ConnectedAppsService,
    private readonly cookies: CookieService,
    private readonly audit: AuditService,
  ) {}

  @Get('sessions')
  @ApiOperation({ summary: 'Devices / browsers currently signed in to AuthDrop' })
  @ApiOkResponse({ type: [PortalSessionResponseDto] })
  async list(@CurrentUser() current: AuthenticatedUser): Promise<PortalSessionResponseDto[]> {
    const rows = await this.sessions.listForUser(current.id);
    return rows.map(({ ref, session }) => ({
      ref,
      current: ref === current.sessionRef,
      ip: session.ip,
      userAgent: session.userAgent,
      amr: session.amr,
      createdAt: new Date(session.createdAt).toISOString(),
      lastSeenAt: new Date(session.lastSeenAt).toISOString(),
    }));
  }

  /**
   * SSO sessions held by the relying-party flow cannot be tied to one portal session, so revoking a portal
   * session also ends the provider SSO sessions: the next app login on this browser silently re-establishes
   * SSO from the (still valid) portal session, while the revoked device has to sign in again.
   */
  @Delete('sessions/:ref')
  @HttpCode(204)
  @ApiOperation({ summary: 'Sign a specific device out' })
  @ApiNoContentResponse()
  async revoke(@Param('ref') ref: string, @CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<void> {
    const removed = await this.sessions.destroyOwnedByRef(current.id, ref);
    if (!removed) throw new NotFoundException('Session not found');
    await this.oidcSessions.endAllSessions(current.id);
    if (ref === current.sessionRef) this.cookies.clearSession(reply);
    await this.audit.record({ event: AuditEvent.SessionRevoked, actorId: current.id, targetType: 'session', targetId: ref.slice(0, 12), ...getRequestMeta(request) });
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  @ApiOperation({ summary: 'Sign out everywhere except this browser' })
  @ApiOkResponse({ type: RevokedCountResponseDto })
  async revokeOthers(@CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest): Promise<RevokedCountResponseDto> {
    const revoked = await this.sessions.destroyAllForUser(current.id, current.sessionRef);
    if (revoked > 0) await this.oidcSessions.endAllSessions(current.id);
    await this.audit.record({ event: AuditEvent.SessionRevoked, actorId: current.id, metadata: { scope: 'others', count: revoked }, ...getRequestMeta(request) });
    return { revoked };
  }

  @Get('connected-apps')
  @ApiOperation({ summary: 'Applications that may sign you in through AuthDrop' })
  @ApiOkResponse({ type: [ConnectedAppResponseDto] })
  async apps(@CurrentUser() current: AuthenticatedUser): Promise<ConnectedAppResponseDto[]> {
    const apps = await this.connectedApps.list(current.id);
    return apps.map((a) => ({ clientId: a.clientId, name: a.name, scopes: a.scopes, authorizedAt: a.authorizedAt.toISOString() }));
  }

  @Delete('connected-apps/:clientId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke an application: its tokens die now and consent is asked again next time' })
  @ApiNoContentResponse()
  async revokeApp(@Param('clientId') clientId: string, @CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest): Promise<void> {
    const revoked = await this.connectedApps.revoke(current.id, clientId);
    if (!revoked) throw new NotFoundException('Application not found');
    await this.audit.record({ event: AuditEvent.AppAccessRevoked, actorId: current.id, targetType: 'client', targetId: clientId, ...getRequestMeta(request) });
  }
}

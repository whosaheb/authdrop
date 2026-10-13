import { Body, Controller, Delete, Get, HttpCode, Patch, PayloadTooLargeException, BadRequestException, Post, Req, Res } from '@nestjs/common';
import { ApiBody, ApiConsumes, ApiCookieAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import '@fastify/multipart';
import { type FastifyReply, type FastifyRequest } from 'fastify';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { getRequestMeta } from '../../common/helpers/request.helper.js';
import { type AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { StorageService, AVATAR_MAX_BYTES } from '../../infrastructure/storage/storage.service.js';
import { AuditService } from '../audit/audit.service.js';
import { CookieService } from '../auth-core/cookie.service.js';
import { SessionService } from '../auth-core/session.service.js';
import { OidcSessionService } from '../oidc/oidc-session.service.js';
import { DeleteAccountDto, UpdateProfileDto, UserResponseDto } from './dto/user.dto.js';
import { toUserDto } from './users.mapper.js';
import { UsersService } from './users.service.js';

@ApiTags('Users')
@ApiCookieAuth('authdrop_session')
@Controller('users/me')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
    private readonly oidcSessions: OidcSessionService,
    private readonly cookies: CookieService,
  ) {}

  private async view(userId: string): Promise<UserResponseDto> {
    const user = await this.users.getWithSocial(userId);
    return toUserDto(user!, this.storage.enabled);
  }

  @Get()
  @ApiOperation({ summary: 'Get the signed-in user profile' })
  @ApiOkResponse({ type: UserResponseDto })
  me(@CurrentUser() current: AuthenticatedUser): Promise<UserResponseDto> {
    return this.view(current.id);
  }

  @Patch()
  @ApiOperation({ summary: 'Update profile fields (e-mail is read-only)' })
  @ApiOkResponse({ type: UserResponseDto })
  async update(@CurrentUser() current: AuthenticatedUser, @Body() dto: UpdateProfileDto, @Req() request: FastifyRequest): Promise<UserResponseDto> {
    await this.users.updateProfile(current.id, dto);
    await this.audit.record({
      event: AuditEvent.UserUpdated,
      actorId: current.id,
      targetType: 'user',
      targetId: current.id,
      metadata: { fields: Object.keys(dto) },
      ...getRequestMeta(request),
    });
    return this.view(current.id);
  }

  @Post('avatar')
  @RateLimit({ name: 'avatar', limit: 10, windowSeconds: 3600, by: ['user'] })
  @ApiOperation({ summary: 'Upload a profile picture (JPEG/PNG/WebP, max 5 MB). It is re-encoded to WebP 512x512.' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', required: ['file'], properties: { file: { type: 'string', format: 'binary' } } } })
  @ApiOkResponse({ type: UserResponseDto })
  async uploadAvatar(@CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest): Promise<UserResponseDto> {
    if (!request.isMultipart()) throw new BadRequestException('Expected multipart/form-data');
    const file = await request.file({ limits: { fileSize: AVATAR_MAX_BYTES, files: 1, fields: 0 } });
    if (!file) throw new BadRequestException('No file uploaded');

    let buffer: Buffer;
    try {
      buffer = await file.toBuffer();
    } catch (error) {
      if ((error as { code?: string }).code === 'FST_REQ_FILE_TOO_LARGE') throw new PayloadTooLargeException('Image must be 5 MB or smaller');
      throw new BadRequestException('Upload failed');
    }
    await this.users.replaceAvatar(current.id, buffer);
    await this.audit.record({ event: AuditEvent.AvatarUpdated, actorId: current.id, targetType: 'user', targetId: current.id, ...getRequestMeta(request) });
    return this.view(current.id);
  }

  @Delete('avatar')
  @ApiOperation({ summary: 'Remove the profile picture' })
  @ApiOkResponse({ type: UserResponseDto })
  async removeAvatar(@CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest): Promise<UserResponseDto> {
    await this.users.removeAvatar(current.id);
    await this.audit.record({ event: AuditEvent.AvatarUpdated, actorId: current.id, targetType: 'user', targetId: current.id, metadata: { removed: true }, ...getRequestMeta(request) });
    return this.view(current.id);
  }

  @Get('export')
  @RateLimit({ name: 'data-export', limit: 5, windowSeconds: 3600, by: ['user'] })
  @ApiOperation({ summary: 'Download all personal data held about you (GDPR/SOC 2 privacy criteria)' })
  async export(@CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply): Promise<Record<string, unknown>> {
    await this.audit.record({ event: AuditEvent.DataExported, actorId: current.id, targetType: 'user', targetId: current.id, ...getRequestMeta(request) });
    void reply.header('Content-Disposition', 'attachment; filename="authdrop-data-export.json"');
    return this.users.exportData(current.id);
  }

  @Delete()
  @HttpCode(204)
  @RateLimit({ name: 'delete-account', limit: 5, windowSeconds: 3600, by: ['user'] })
  @ApiOperation({ summary: 'Permanently delete the account and revoke every session and app grant' })
  @ApiNoContentResponse()
  async deleteAccount(
    @CurrentUser() current: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
    @Req() request: FastifyRequest,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<void> {
    if (dto.confirmEmail !== current.email) throw new BadRequestException('Confirmation e-mail does not match your account');
    await this.oidcSessions.revokeAllGrants(current.id);
    await this.oidcSessions.endAllSessions(current.id);
    await this.sessions.destroyAllForUser(current.id);
    await this.users.deleteAccount(current.id);
    this.cookies.clearSession(reply);
    await this.audit.record({ event: AuditEvent.UserDeleted, actorId: current.id, targetType: 'user', targetId: current.id, ...getRequestMeta(request) });
  }
}

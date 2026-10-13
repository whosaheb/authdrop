import { Body, Controller, Delete, ForbiddenException, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import { ApiCookieAuth, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { type FastifyRequest } from 'fastify';
import { AuditEvent } from '../../common/constants/audit-events.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RateLimit } from '../../common/decorators/rate-limit.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { MessageResponseDto } from '../../common/dto/message-response.dto.js';
import { getRequestMeta } from '../../common/helpers/request.helper.js';
import { type AuthenticatedUser } from '../../common/interfaces/authenticated-user.interface.js';
import { AppConfig } from '../../config/app-config.service.js';
import { PrismaService } from '../../infrastructure/prisma/prisma.service.js';
import { AuditService } from '../audit/audit.service.js';
import {
  ClientCredentialsResponseDto,
  ClientLogsQueryDto,
  ClientLogsResponseDto,
  ClientMetricsResponseDto,
  ClientResponseDto,
  CreateClientDto,
  UpdateClientDto,
} from './dto/client.dto.js';
import { ClientsService, toClientDto } from './clients.service.js';

@ApiTags('Developer console')
@ApiCookieAuth('authdrop_session')
@Controller('developer')
export class DeveloperController {
  constructor(
    private readonly clients: ClientsService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly audit: AuditService,
  ) {}

  @Post('enroll')
  @HttpCode(200)
  @ApiOperation({ summary: 'Turn the account into a developer account (when self-enrolment is enabled)' })
  @ApiOkResponse({ type: MessageResponseDto })
  async enroll(@CurrentUser() current: AuthenticatedUser, @Req() request: FastifyRequest): Promise<MessageResponseDto> {
    if (current.role !== 'USER') return new MessageResponseDto('Already a developer');
    if (!this.config.developerSelfEnroll) throw new ForbiddenException('Developer access is granted by an administrator');
    await this.prisma.user.update({ where: { id: current.id }, data: { role: 'DEVELOPER' } });
    await this.audit.record({ event: AuditEvent.DeveloperEnrolled, actorId: current.id, targetType: 'user', targetId: current.id, ...getRequestMeta(request) });
    return new MessageResponseDto('Developer access enabled');
  }

  @Get('clients')
  @Roles('DEVELOPER', 'ADMIN')
  @ApiOperation({ summary: 'List your registered applications' })
  @ApiOkResponse({ type: [ClientResponseDto] })
  async list(@CurrentUser() current: AuthenticatedUser): Promise<ClientResponseDto[]> {
    return (await this.clients.list(current.id)).map(toClientDto);
  }

  @Post('clients')
  @Roles('DEVELOPER', 'ADMIN')
  @RateLimit({ name: 'client-create', limit: 20, windowSeconds: 3600, by: ['user'] })
  @ApiOperation({ summary: 'Register an application. The client secret is returned ONCE.' })
  @ApiCreatedResponse({ type: ClientCredentialsResponseDto })
  create(@CurrentUser() current: AuthenticatedUser, @Body() dto: CreateClientDto, @Req() request: FastifyRequest): Promise<ClientCredentialsResponseDto> {
    return this.clients.create(current.id, dto, getRequestMeta(request));
  }

  @Get('clients/:clientId')
  @Roles('DEVELOPER', 'ADMIN')
  @ApiParam({ name: 'clientId' })
  @ApiOperation({ summary: 'Get one application' })
  @ApiOkResponse({ type: ClientResponseDto })
  async get(@CurrentUser() current: AuthenticatedUser, @Param('clientId') clientId: string): Promise<ClientResponseDto> {
    return toClientDto(await this.clients.get(current.id, clientId));
  }

  @Patch('clients/:clientId')
  @Roles('DEVELOPER', 'ADMIN')
  @ApiParam({ name: 'clientId' })
  @ApiOperation({ summary: 'Rename an application or change its callback URLs' })
  @ApiOkResponse({ type: ClientResponseDto })
  async update(@CurrentUser() current: AuthenticatedUser, @Param('clientId') clientId: string, @Body() dto: UpdateClientDto, @Req() request: FastifyRequest): Promise<ClientResponseDto> {
    return toClientDto(await this.clients.update(current.id, clientId, dto, getRequestMeta(request)));
  }

  @Post('clients/:clientId/rotate-secret')
  @HttpCode(200)
  @Roles('DEVELOPER', 'ADMIN')
  @RateLimit({ name: 'client-rotate', limit: 10, windowSeconds: 3600, by: ['user'] })
  @ApiParam({ name: 'clientId' })
  @ApiOperation({ summary: 'Issue a new client secret (the old one stops working immediately). Returned ONCE.' })
  @ApiOkResponse({ type: ClientCredentialsResponseDto })
  rotate(@CurrentUser() current: AuthenticatedUser, @Param('clientId') clientId: string, @Req() request: FastifyRequest): Promise<ClientCredentialsResponseDto> {
    return this.clients.rotateSecret(current.id, clientId, getRequestMeta(request));
  }

  @Delete('clients/:clientId')
  @HttpCode(204)
  @Roles('DEVELOPER', 'ADMIN')
  @ApiParam({ name: 'clientId' })
  @ApiOperation({ summary: 'Delete an application and revoke everything issued to it' })
  @ApiNoContentResponse()
  remove(@CurrentUser() current: AuthenticatedUser, @Param('clientId') clientId: string, @Req() request: FastifyRequest): Promise<void> {
    return this.clients.remove(current.id, clientId, getRequestMeta(request));
  }

  @Get('clients/:clientId/logs')
  @Roles('DEVELOPER', 'ADMIN')
  @ApiParam({ name: 'clientId' })
  @ApiOperation({ summary: 'Usage log: authorizations, token grants and configuration changes' })
  @ApiOkResponse({ type: ClientLogsResponseDto })
  logs(@CurrentUser() current: AuthenticatedUser, @Param('clientId') clientId: string, @Query() query: ClientLogsQueryDto): Promise<ClientLogsResponseDto> {
    const limit = Math.min(Math.max(Number(query.limit ?? 25) || 25, 1), 100);
    return this.clients.logs(current.id, clientId, limit, query.cursor);
  }

  @Get('clients/:clientId/metrics')
  @Roles('DEVELOPER', 'ADMIN')
  @ApiParam({ name: 'clientId' })
  @ApiOperation({ summary: 'Daily usage counters for the last 30 days' })
  @ApiOkResponse({ type: ClientMetricsResponseDto })
  metrics(@CurrentUser() current: AuthenticatedUser, @Param('clientId') clientId: string): Promise<ClientMetricsResponseDto> {
    return this.clients.metrics(current.id, clientId);
  }
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { IsRedirectUriList } from '../../../common/validators/is-redirect-uri.validator.js';
import { ClientType, TokenEndpointAuthMethod } from '../../../generated/prisma/client.js';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);

export class CreateClientDto {
  @ApiProperty({ example: 'Acme Dashboard', maxLength: 60 })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(60) @Matches(/^[^<>\u0000-\u001f]+$/, { message: 'name contains invalid characters' })
  name!: string;

  @ApiProperty({ type: [String], example: ['https://app.acme.test/callback'], description: 'Exact-match callback URLs (https, or http on localhost)' })
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ArrayUnique() @IsRedirectUriList()
  redirectUris!: string[];

  @ApiPropertyOptional({ type: [String], description: 'Where users may be sent after RP-initiated logout' })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsRedirectUriList()
  postLogoutRedirectUris?: string[];

  @ApiPropertyOptional({ enum: ClientType, default: 'CONFIDENTIAL', description: 'PUBLIC = SPA / mobile app without a secret (PKCE only)' })
  @IsOptional() @IsIn(Object.values(ClientType))
  clientType?: ClientType;

  @ApiPropertyOptional({ enum: [TokenEndpointAuthMethod.CLIENT_SECRET_BASIC, TokenEndpointAuthMethod.CLIENT_SECRET_POST], default: 'CLIENT_SECRET_BASIC' })
  @IsOptional() @IsIn([TokenEndpointAuthMethod.CLIENT_SECRET_BASIC, TokenEndpointAuthMethod.CLIENT_SECRET_POST])
  tokenEndpointAuthMethod?: TokenEndpointAuthMethod;
}

export class UpdateClientDto {
  @ApiPropertyOptional({ maxLength: 60 })
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(60) @Matches(/^[^<>\u0000-\u001f]+$/)
  name?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(10) @ArrayUnique() @IsRedirectUriList()
  redirectUris?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional() @IsArray() @ArrayMaxSize(10) @ArrayUnique() @IsRedirectUriList()
  postLogoutRedirectUris?: string[];
}

export class ClientResponseDto {
  @ApiProperty({ example: 'ad_kP3x...' }) clientId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ enum: ClientType }) clientType!: ClientType;
  @ApiProperty({ enum: TokenEndpointAuthMethod }) tokenEndpointAuthMethod!: TokenEndpointAuthMethod;
  @ApiProperty({ type: [String] }) redirectUris!: string[];
  @ApiProperty({ type: [String] }) postLogoutRedirectUris!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
}

export class ClientCredentialsResponseDto extends ClientResponseDto {
  @ApiPropertyOptional({ nullable: true, description: 'Shown exactly once. Null for public clients.' })
  clientSecret!: string | null;
}

export class ClientLogEntryDto {
  @ApiProperty() id!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ example: 'oidc.token.granted' }) event!: string;
  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] }) outcome!: string;
  @ApiPropertyOptional({ nullable: true, description: 'The `sub` your application sees for the user' }) sub!: string | null;
}

export class ClientLogsQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional() @Transform(({ value }: { value: unknown }) => Number(value)) @Matches(/^\d+$/, { message: 'limit must be a number' })
  limit?: number | string;

  @ApiPropertyOptional({ description: 'Cursor from nextCursor' })
  @IsOptional() @IsString() @Matches(/^\d{1,19}$/)
  cursor?: string;
}

export class ClientLogsResponseDto {
  @ApiProperty({ type: [ClientLogEntryDto] }) items!: ClientLogEntryDto[];
  @ApiProperty({ nullable: true }) nextCursor!: string | null;
}

export class DailyMetricDto {
  @ApiProperty({ example: '2026-10-10' }) day!: string;
  @ApiProperty({ example: 'oidc.authorization.success' }) event!: string;
  @ApiProperty({ example: 12 }) count!: number;
}

export class ClientMetricsResponseDto {
  @ApiProperty({ description: 'Users who currently have an active grant for this app' }) activeUsers!: number;
  @ApiProperty({ example: 30 }) windowDays!: number;
  @ApiProperty({ type: [DailyMetricDto] }) daily!: DailyMetricDto[];
}

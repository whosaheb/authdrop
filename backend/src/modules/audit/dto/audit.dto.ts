import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

export class AuditQueryDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 25 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100)
  limit: number = 25;

  @ApiPropertyOptional({ description: 'Pagination cursor returned as nextCursor' })
  @IsOptional() @IsString() @Matches(/^\d{1,19}$/)
  cursor?: string;

  @ApiPropertyOptional({ example: 'auth.login.success' })
  @IsOptional() @IsString() @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  event?: string;

  @ApiPropertyOptional({ description: 'Filter by acting user id' })
  @IsOptional() @IsString()
  actorId?: string;
}

export class AuditEntryResponseDto {
  @ApiProperty({ example: '1042' }) id!: string;
  @ApiProperty() occurredAt!: string;
  @ApiProperty({ example: 'auth.login.success' }) event!: string;
  @ApiProperty({ enum: ['SUCCESS', 'FAILURE'] }) outcome!: string;
  @ApiPropertyOptional({ nullable: true }) actorId!: string | null;
  @ApiPropertyOptional({ nullable: true }) targetType!: string | null;
  @ApiPropertyOptional({ nullable: true }) targetId!: string | null;
  @ApiPropertyOptional({ nullable: true }) ip!: string | null;
  @ApiPropertyOptional({ nullable: true }) requestId!: string | null;
  @ApiPropertyOptional({ nullable: true, type: 'object', additionalProperties: true }) metadata!: Record<string, unknown> | null;
}

export class AuditPageResponseDto {
  @ApiProperty({ type: [AuditEntryResponseDto] }) items!: AuditEntryResponseDto[];
  @ApiProperty({ nullable: true, example: '1017' }) nextCursor!: string | null;
}

export class AuditVerifyResponseDto {
  @ApiProperty({ example: 5000 }) checked!: number;
  @ApiProperty({ example: true }) valid!: boolean;
  @ApiProperty({ nullable: true, example: null }) brokenAtId!: string | null;
}

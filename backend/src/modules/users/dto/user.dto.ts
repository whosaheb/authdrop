import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, ValidateIf } from 'class-validator';
import { Gender, UserRole } from '../../../generated/prisma/client.js';
import { normalizeEmail } from '../../../common/helpers/email.helper.js';

const trim = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.trim() : value);
/** Names: no markup characters or control characters (output is escaped anyway; this is defence in depth). */
export const NAME_PATTERN = /^[^<>\u0000-\u001f\u007f]+$/;

export class EmailDto {
  @ApiProperty({ example: 'ada@example.com', description: 'Normalised (trimmed, lower-cased) before use' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail() @MaxLength(254)
  email!: string;
}

export class NameFieldsDto {
  @ApiProperty({ example: 'Ada', maxLength: 80 })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) @Matches(NAME_PATTERN, { message: 'firstName contains invalid characters' })
  firstName!: string;

  @ApiProperty({ example: 'Lovelace', maxLength: 80 })
  @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) @Matches(NAME_PATTERN, { message: 'lastName contains invalid characters' })
  lastName!: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Ada', maxLength: 80 })
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) @Matches(NAME_PATTERN)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Lovelace', maxLength: 80 })
  @IsOptional() @Transform(trim) @IsString() @IsNotEmpty() @MaxLength(80) @Matches(NAME_PATTERN)
  lastName?: string;

  @ApiPropertyOptional({ enum: Gender, nullable: true, description: 'Send null to clear' })
  @ValidateIf((_o, v) => v !== null) @IsOptional() @IsIn(Object.values(Gender))
  gender?: Gender | null;

  @ApiPropertyOptional({ example: '1990-12-10', nullable: true, description: 'ISO date (YYYY-MM-DD). Send null to clear' })
  @ValidateIf((_o, v) => v !== null) @IsOptional() @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'dateOfBirth must be YYYY-MM-DD' })
  dateOfBirth?: string | null;
}

export class DeleteAccountDto {
  @ApiProperty({ example: 'ada@example.com', description: 'Must equal your account e-mail (typing confirmation)' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? normalizeEmail(value) : value))
  @IsEmail()
  confirmEmail!: string;
}

export class LinkedProviderDto {
  @ApiProperty({ example: 'google' }) provider!: string;
  @ApiProperty({ example: '2026-10-10T11:51:00.000Z' }) linkedAt!: string;
}

export class UserResponseDto {
  @ApiProperty({ example: '0192f5c4-8c0e-7b31-8d5c-6f4c2f6b2e11' }) id!: string;
  @ApiProperty({ example: 'ada@example.com', description: 'Read-only' }) email!: string;
  @ApiProperty() emailVerified!: boolean;
  @ApiProperty() firstName!: string;
  @ApiProperty() lastName!: string;
  @ApiPropertyOptional({ enum: Gender, nullable: true }) gender!: Gender | null;
  @ApiPropertyOptional({ example: '1990-12-10', nullable: true }) dateOfBirth!: string | null;
  @ApiPropertyOptional({ nullable: true }) avatarUrl!: string | null;
  @ApiProperty({ enum: UserRole }) role!: UserRole;
  @ApiProperty() totpEnabled!: boolean;
  @ApiProperty({ type: [LinkedProviderDto] }) linkedProviders!: LinkedProviderDto[];
  @ApiProperty({ description: 'False when R2 is not configured; the UI hides the upload control' }) avatarUploadEnabled!: boolean;
  @ApiProperty() createdAt!: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches } from 'class-validator';
import { EmailDto, NameFieldsDto } from '../../users/dto/user.dto.js';
import { SecondFactorDto } from '../../mfa/dto/mfa.dto.js';
import { UserResponseDto } from '../../users/dto/user.dto.js';

const UID_PATTERN = /^[\w-]{10,64}$/;
const digitsOnly = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);

const UID_DOC = 'OIDC interaction id from /login?uid=... when the sign-in was started by an application';

export class OtpRequestDto extends EmailDto {
  @ApiPropertyOptional({ description: UID_DOC })
  @IsOptional() @IsString() @Matches(UID_PATTERN)
  uid?: string;
}

export class OtpVerifyDto extends EmailDto {
  @ApiProperty({ example: '482913', description: '6-digit code received by e-mail' })
  @Transform(digitsOnly) @IsString() @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;

  @ApiPropertyOptional({ description: UID_DOC })
  @IsOptional() @IsString() @Matches(UID_PATTERN)
  uid?: string;
}

export class MfaVerifyDto extends SecondFactorDto {}

export class RegisterProfileDto extends NameFieldsDto {}

export class ConsentDecisionDto {
  @ApiProperty({ description: 'true = allow the application, false = deny' })
  @IsBoolean()
  approve!: boolean;
}

export type AuthStatus = 'authenticated' | 'mfa_required' | 'profile_required' | 'profile_created';

export class AuthStepResponseDto {
  @ApiProperty({
    enum: ['authenticated', 'mfa_required', 'profile_required', 'profile_created'],
    description:
      'authenticated: signed in (follow redirectTo). mfa_required: ask for the second factor. ' +
      'profile_required: new user, ask for the name. profile_created: account exists, optional security wizard next.',
  })
  status!: AuthStatus;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Where to send the browser. Absolute URL = full navigation (resumes the relying-party flow); relative = portal route.',
    example: '/account/settings',
  })
  redirectTo!: string | null;
}

export class PreauthStateDto {
  @ApiProperty({ enum: ['mfa', 'profile', 'security_setup'] }) step!: 'mfa' | 'profile' | 'security_setup';
  @ApiPropertyOptional({ example: 'a***@example.com', description: 'Masked address (never the full e-mail)' }) maskedEmail?: string;
  @ApiPropertyOptional({ description: 'Pre-fill from a social provider' }) firstName?: string;
  @ApiPropertyOptional({ description: 'Pre-fill from a social provider' }) lastName?: string;
}

export class SocialProviderInfoDto {
  @ApiProperty({ example: 'google' }) id!: string;
  @ApiProperty({ example: 'Google' }) name!: string;
}

export class SessionStateResponseDto {
  @ApiProperty() authenticated!: boolean;
  @ApiPropertyOptional({ type: UserResponseDto }) user?: UserResponseDto;
  @ApiPropertyOptional({ type: PreauthStateDto, description: 'Present while a sign-in or registration is half-way' }) preauth?: PreauthStateDto;
  @ApiProperty({ type: [SocialProviderInfoDto], description: 'Social sign-in methods that are configured on this server' }) providers!: SocialProviderInfoDto[];
}

export class InteractionDetailsResponseDto {
  @ApiProperty() uid!: string;
  @ApiProperty({ enum: ['login', 'consent'] }) prompt!: string;
  @ApiProperty({ example: 'Acme Dashboard' }) clientName!: string;
  @ApiProperty({ type: [String], example: ['openid', 'email', 'profile'] }) scopes!: string[];
  @ApiProperty({ description: 'The application demanded a fresh sign-in; do not reuse the current session' }) forceReauth!: boolean;
}

export class InteractionResultResponseDto {
  @ApiProperty({ enum: ['redirect', 'consent_required'] }) status!: 'redirect' | 'consent_required';
  @ApiPropertyOptional({ nullable: true, description: 'Absolute URL that resumes the application login' }) redirectTo!: string | null;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, ValidateIf } from 'class-validator';

const digitsOnly = ({ value }: { value: unknown }): unknown => (typeof value === 'string' ? value.replace(/\s+/g, '') : value);

export class TotpCodeDto {
  @ApiProperty({ example: '123456', description: '6-digit code from the authenticator app' })
  @Transform(digitsOnly) @IsString() @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code!: string;
}

/** Second factor: either an authenticator code or a single-use backup code. */
export class SecondFactorDto {
  @ApiPropertyOptional({ example: '123456' })
  @ValidateIf((o: SecondFactorDto) => o.backupCode === undefined) @Transform(digitsOnly) @IsString() @Matches(/^\d{6}$/, { message: 'code must be 6 digits' })
  code?: string;

  @ApiPropertyOptional({ example: 'ABCDE-FGH23', description: 'One of your single-use recovery codes' })
  @IsOptional() @IsString() @Matches(/^[A-Za-z0-9\s-]{10,12}$/, { message: 'backupCode format is invalid' })
  backupCode?: string;
}

export class MfaStatusResponseDto {
  @ApiProperty() enabled!: boolean;
  @ApiPropertyOptional({ nullable: true }) enabledAt!: string | null;
  @ApiProperty({ example: 8 }) backupCodesRemaining!: number;
}

export class TotpSetupResponseDto {
  @ApiProperty({ description: 'Base32 secret for manual entry', example: 'JBSWY3DPEHPK3PXP' }) secret!: string;
  @ApiProperty({ example: 'otpauth://totp/AuthDrop:ada%40example.com?secret=...' }) otpauthUrl!: string;
  @ApiProperty({ description: 'PNG data URL of the QR code' }) qrCodeDataUrl!: string;
}

export class BackupCodesResponseDto {
  @ApiProperty({ type: [String], example: ['ABCDE-FGH23'], description: 'Shown ONCE. Store them somewhere safe.' }) codes!: string[];
}

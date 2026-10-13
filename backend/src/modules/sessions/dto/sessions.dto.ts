import { ApiProperty } from '@nestjs/swagger';

export class PortalSessionResponseDto {
  @ApiProperty({ description: 'Opaque, non-reversible session handle (safe to expose)' }) ref!: string;
  @ApiProperty({ description: 'True for the session making this request' }) current!: boolean;
  @ApiProperty({ example: '203.0.113.7' }) ip!: string;
  @ApiProperty({ example: 'Mozilla/5.0 ...' }) userAgent!: string;
  @ApiProperty({ type: [String], example: ['otp', 'mfa'] }) amr!: string[];
  @ApiProperty() createdAt!: string;
  @ApiProperty() lastSeenAt!: string;
}

export class ConnectedAppResponseDto {
  @ApiProperty({ example: 'ad_3f9c...' }) clientId!: string;
  @ApiProperty({ example: 'Acme Dashboard' }) name!: string;
  @ApiProperty({ type: [String], example: ['openid', 'email'] }) scopes!: string[];
  @ApiProperty() authorizedAt!: string;
}

export class RevokedCountResponseDto {
  @ApiProperty({ example: 2 }) revoked!: number;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Shape of every non-2xx response (produced by AllExceptionsFilter). */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ example: 'Bad Request' })
  error!: string;

  @ApiProperty({ example: ['email must be an email'], description: 'Human readable message(s)', type: [String] })
  message!: string[];

  @ApiProperty({ example: '0192f5c4-8c0e-7b31-8d5c-6f4c2f6b2e11', description: 'Quote this when contacting support' })
  requestId!: string;

  @ApiProperty({ example: '2026-10-10T11:51:00.000Z' })
  timestamp!: string;

  @ApiProperty({ example: '/api/auth/otp/request' })
  path!: string;

  @ApiPropertyOptional({ example: 42, description: 'Seconds to wait (429 only)' })
  retryAfterSeconds?: number;
}

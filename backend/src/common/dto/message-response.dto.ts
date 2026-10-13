import { ApiProperty } from '@nestjs/swagger';

export class MessageResponseDto {
  @ApiProperty({ example: 'Done' })
  message!: string;

  constructor(message: string) {
    this.message = message;
  }
}

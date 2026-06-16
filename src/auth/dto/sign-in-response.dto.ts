import { ApiProperty } from '@nestjs/swagger';

export class SignInResponseDto {
  @ApiProperty({ description: 'Token JWT para autenticação' })
  access_token: string;
}

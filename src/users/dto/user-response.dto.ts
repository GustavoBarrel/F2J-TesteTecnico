import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ description: 'ID do usuário' })
  id: string;

  @ApiProperty({ description: 'Nome do usuário' })
  firstName: string;
  @ApiProperty({ description: 'Sobrenome do usuário' })
  lastName: string;
  @ApiProperty({ description: 'Email do usuário' })
  email: string;
  @ApiProperty({ description: 'Nome de usuário do usuário' })
  username: string;
  @ApiProperty({ description: 'Se o usuário é global admin' })
  isGlobalAdmin: boolean;
  @ApiProperty({ description: 'Se o usuário está ativo' })
  isActive: boolean;
  @ApiProperty({ description: 'Data de criação do usuário' })
  createdAt: Date;
}

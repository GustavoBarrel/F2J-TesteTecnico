import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SignInDto {
    
  @ApiProperty({
    description: 'Username',
    example: 'admin',
  })
  @IsString()
  @IsNotEmpty()
  username: string;

  @ApiProperty({
    description: 'Senha',
    example: 'admin123',
  })
  @IsString()
  @IsNotEmpty()
  password: string;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class RequestPasswordResetDto {
  @ApiPropertyOptional({ example: 'joao.silva' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  username?: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

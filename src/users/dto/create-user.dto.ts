import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const SINGLE_WORD_REGEX = /^\S+$/;
const SINGLE_WORD_MESSAGE = 'Deve ser uma única palavra, sem espaços';

export class CreateUserDto {
  @ApiProperty({ example: 'João' })
  @IsString({ message: 'O nome deve ser uma string' })
  @IsNotEmpty({ message: 'O nome é obrigatório' })
  @Matches(SINGLE_WORD_REGEX, { message: `Nome: ${SINGLE_WORD_MESSAGE}` })
  firstName: string;

  @ApiProperty({ example: 'Silva' })
  @IsString({ message: 'O sobrenome deve ser uma string' })
  @IsNotEmpty({ message: 'O sobrenome é obrigatório' })
  @Matches(SINGLE_WORD_REGEX, { message: `Sobrenome: ${SINGLE_WORD_MESSAGE}` })
  lastName: string;

  @ApiProperty({ example: 'joao@email.com' })
  @IsEmail({}, { message: 'O email deve ser um email válido' })
  email: string;

  @ApiPropertyOptional({
    example: 'joao',
    description:
      'Se não informado, será gerado automaticamente como firstName.lastName',
  })
  @IsOptional()
  @IsString({ message: 'O username deve ser uma string' })
  username?: string;

  @ApiProperty({ example: '123456' })
  @IsString({ message: 'A senha deve ser uma string' })
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
  password: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional({ message: 'O isGlobalAdmin deve ser um booleano' })
  @IsBoolean({ message: 'O isGlobalAdmin deve ser um booleano' })
  isGlobalAdmin?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional({ message: 'O isActive deve ser um booleano' })
  @IsBoolean({ message: 'O isActive deve ser um booleano' })
  isActive?: boolean;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
  Validate,
  ValidatorConstraint,
  type ValidationArguments,
  type ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'passwordsMatch', async: false })
class PasswordsMatchConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args: ValidationArguments): boolean {
    const dto = args.object as ConfirmPasswordResetDto;
    return dto.password === dto.passwordConfirmation;
  }

  defaultMessage(): string {
    return 'A confirmação de senha deve ser igual à senha';
  }
}

export class ConfirmPasswordResetDto {
  @ApiPropertyOptional({ example: 'joao.silva' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  username?: string;

  @ApiPropertyOptional({ example: 'joao@email.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    example: '482913',
    description: 'Código de 6 dígitos recebido por e-mail',
  })
  @IsString()
  @Length(6, 6, { message: 'O código deve ter 6 dígitos' })
  @Matches(/^\d{6}$/, { message: 'O código deve conter apenas números' })
  code: string;

  @ApiProperty({ example: 'novaSenha123', minLength: 6 })
  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres' })
  password: string;

  @ApiProperty({
    example: 'novaSenha123',
    minLength: 6,
    description: 'Deve ser igual ao campo password',
  })
  @IsString()
  @MinLength(6, { message: 'A confirmação deve ter pelo menos 6 caracteres' })
  @Validate(PasswordsMatchConstraint)
  passwordConfirmation: string;
}

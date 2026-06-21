import { ApiProperty } from '@nestjs/swagger';

export class PasswordResetRequestResponseDto {
  @ApiProperty({ description: 'Indica se o e-mail foi enviado com sucesso' })
  sent: boolean;

  @ApiProperty({ example: 'Código enviado para o e-mail cadastrado' })
  message: string;
}

export class PasswordResetConfirmResponseDto {
  @ApiProperty({ example: 'Senha redefinida com sucesso' })
  message: string;
}

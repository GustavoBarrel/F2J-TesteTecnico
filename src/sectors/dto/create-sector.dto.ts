import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { IsBoolean } from 'class-validator';

export class CreateSectorDto {
  @ApiProperty({
    description: 'O Nome do Setor',
    example: 'TI',
  })
  @IsString({ message: 'O Nome do Setor é obrigatório' })
  @IsNotEmpty({ message: 'O Nome do Setor é obrigatório' })
  name: string;

  @ApiProperty({
    description: 'Se o Setor está ativo',
    example: 'true',
  })
  @IsBoolean({ message: 'Se o Setor está ativo é obrigatório' })
  @IsNotEmpty({ message: 'Se o Setor está ativo é obrigatório' })
  active: boolean;

  @ApiProperty({
    description: 'Se o Gerente pode visualizar o Setor',
    example: true,
  })
  @IsBoolean({ message: 'Se o Gerente pode visualizar o Setor é obrigatório' })
  @IsNotEmpty({ message: 'Se o Gerente pode visualizar o Setor é obrigatório' })
  onlyManagerCanView: boolean;

  @ApiProperty({
    description: 'Se o Gerente pode editar o Setor',
    example: true,
  })
  @IsBoolean({ message: 'Se o Gerente pode editar o Setor é obrigatório' })
  @IsNotEmpty({ message: 'Se o Gerente pode editar o Setor é obrigatório' })
  onlyManagerCanEdit: boolean;

  @ApiProperty({
    description: 'Se o Gerente pode arquivar o Setor',
    example: true,
  })
  @IsBoolean({ message: 'Se o Gerente pode arquivar o Setor é obrigatório' })
  @IsNotEmpty({ message: 'Se o Gerente pode arquivar o Setor é obrigatório' })
  onlyManagerCanArchive: boolean;
}

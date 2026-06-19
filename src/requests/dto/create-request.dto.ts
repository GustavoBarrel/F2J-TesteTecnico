import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  ArrayUnique,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({
    description: 'O título da solicitação',
    example: 'Solicitação de ajuda',
  })
  @IsString({ message: 'O título da solicitação deve ser uma string' })
  @IsNotEmpty({ message: 'O título da solicitação é obrigatório' })
  title: string;

  @ApiProperty({
    description: 'A descrição da solicitação',
    example: 'Estou com problema no meu computador',
  })
  @IsString({ message: 'A descrição da solicitação deve ser uma string' })
  @IsNotEmpty({ message: 'A descrição da solicitação é obrigatório' })
  description: string;

  @ApiProperty({
    description: 'O ID do serviço do setor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString({ message: 'O ID do serviço do setor deve ser uma string' })
  @IsNotEmpty({ message: 'O ID do serviço do setor é obrigatório' })
  sectorServiceId: string;

  @ApiPropertyOptional({
    description: 'IDs dos observadores (qualquer usuário ativo do sistema)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsUUID('4', { each: true })
  observerIds?: string[];
}

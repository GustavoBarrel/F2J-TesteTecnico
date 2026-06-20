import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { RequestPriority } from '../../../generated/prisma/client';

export class UpdateRequestDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @ApiPropertyOptional({ description: 'Título da solicitação' })
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  @ApiPropertyOptional({ description: 'Descrição da solicitação' })
  description?: string;

  @IsOptional()
  @IsEnum(RequestPriority)
  @ApiPropertyOptional({
    enum: RequestPriority,
    description: 'Prioridade da solicitação',
  })
  priority?: RequestPriority;
}

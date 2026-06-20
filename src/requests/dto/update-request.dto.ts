import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { RequestPriority, RequestStatus } from '../../../generated/prisma/client';

const ALLOWED_STATUSES = [
  RequestStatus.PENDING,
  RequestStatus.IN_PROGRESS,
  RequestStatus.SOLVED,
] as const;

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
  @ApiPropertyOptional({ enum: RequestPriority, description: 'Prioridade da solicitação' })
  priority?: RequestPriority;

  @IsOptional()
  @IsEnum(ALLOWED_STATUSES, {
    message: `status deve ser um dos valores: ${ALLOWED_STATUSES.join(', ')}`,
  })
  @ApiPropertyOptional({
    enum: ALLOWED_STATUSES,
    description: 'Novo status da solicitação',
  })
  status?: (typeof ALLOWED_STATUSES)[number];
}

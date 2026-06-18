import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { RequestPriority, RequestStatus } from '../../../generated/prisma/client';
import { PaginationQueryDto } from 'src/common/dto/pagination-query.dto';

export class FindAllRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('4', { message: 'O sectorId deve ser um UUID válido' })
  @ApiPropertyOptional({ description: 'Filtrar por setor' })
  sectorId?: string;

  @IsOptional()
  @IsEnum(RequestStatus, { message: 'O status deve ser um valor válido' })
  @ApiPropertyOptional({ enum: RequestStatus, description: 'Filtrar por status' })
  status?: RequestStatus;
}

export class FindSectorRequestsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsEnum(RequestStatus)
  @ApiPropertyOptional({ enum: RequestStatus, description: 'Filtrar por status' })
  status?: RequestStatus;

  @IsOptional()
  @IsEnum(RequestPriority)
  @ApiPropertyOptional({ enum: RequestPriority, description: 'Filtrar por prioridade' })
  priority?: RequestPriority;

  @IsOptional()
  @IsString()
  @ApiPropertyOptional({ description: 'Busca por título ou descrição' })
  search?: string;

  @IsOptional()
  @IsEnum(['queue'], { message: 'scope deve ser "queue"' })
  @ApiPropertyOptional({ enum: ['queue'], description: 'queue = apenas solicitações sem atribuído' })
  scope?: 'queue';
}

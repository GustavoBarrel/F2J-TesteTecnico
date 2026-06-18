import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsString } from 'class-validator';

export class SectorServiceResponseDto {
  @ApiProperty({
    description: 'O ID do Serviço do Setor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'O Nome do Serviço do Setor',
    example: 'Serviço 1',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Se o Serviço do Setor está ativo ou não',
    example: 'true',
  })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({
    description: 'O ID do Setor ao qual o Serviço pertence',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsString()
  sectorId: string;

  @ApiProperty({
    description: 'A data e hora da criação do Serviço do Setor',
    example: '2026-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'A data e hora da última atualização do Serviço do Setor',
    example: '2026-01-01T00:00:00.000Z',
  })
  updatedAt: Date;
}

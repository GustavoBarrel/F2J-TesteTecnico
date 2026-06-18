import { ApiProperty } from '@nestjs/swagger';
import { SectorServiceResponseDto } from 'src/sector-services/dto/sector-service-response.dto';

export class SectorResponseDto {
  @ApiProperty({
    description: 'o identificador único do setor',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    description: 'o nome do setor',
    example: 'TI',
  })
  name: string;

  @ApiProperty({
    description: 'se o gerente pode visualizar o setor',
    example: true,
  })
  onlyManagerCanView: boolean;

  @ApiProperty({
    description: 'se o gerente pode editar o setor',
    example: true,
  })
  onlyManagerCanEdit: boolean;

  @ApiProperty({
    description: 'se o gerente pode arquivar o setor',
    example: true,
  })
  onlyManagerCanArchive: boolean;

  @ApiProperty({
    description: 'se o setor está ativo',
    example: true,
  })
  isActive: boolean;

  @ApiProperty({
    description: 'a data e hora da criação do setor',
    example: '2021-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'a data e hora da última atualização do setor',
    example: '2021-01-01T00:00:00.000Z',
  })
  updatedAt: Date;

  @ApiProperty({
    description: 'os serviços do setor',
    type: () => SectorServiceResponseDto,
    isArray: true,
    required: false,
  })
  sectorServices?: SectorServiceResponseDto[];
}
